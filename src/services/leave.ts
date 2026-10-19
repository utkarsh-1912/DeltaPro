import { LeaveStatus, type LeaveRequest, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit, notify, type Db } from "@/lib/activity";
import { HttpError, assertCanApproveFor, isPeopleAdmin, type SessionUser } from "@/lib/api";
import { emitEvent, scheduleDispatch } from "@/integrations/events";
import { approversFor, person, toUtcDay, weekdaysBetween, ymd } from "./shared";

export const LEAVE_TYPES = ["CASUAL", "SICK", "EARNED", "UNPAID"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const DEFAULT_BALANCES: { type: LeaveType; total: number }[] = [
    { type: "CASUAL", total: 12 },
    { type: "SICK", total: 10 },
    { type: "EARNED", total: 15 },
];

export async function ensureBalances(userId: string, year: number, db: Db = prisma) {
    await db.leaveBalance.createMany({
        data: DEFAULT_BALANCES.map(b => ({ userId, type: b.type, total: b.total, available: b.total, used: 0, year })),
        skipDuplicates: true,
    });
}

type WithUser = LeaveRequest & { user: Pick<User, "id" | "name" | "email">; approver?: Pick<User, "id" | "name" | "email"> | null };

async function eventData(req: WithUser, db: Db, extra: Record<string, unknown> = {}) {
    return {
        request: {
            id: req.id,
            type: req.type,
            startDate: ymd(req.startDate),
            endDate: ymd(req.endDate),
            duration: req.duration,
            isHalfDay: req.isHalfDay,
            isPaid: req.isPaid,
            reason: req.reason,
            status: req.status,
        },
        user: person(req.user),
        approver: person(req.approver ?? null),
        managers: await approversFor(req.userId, db),
        ...extra,
    };
}

export type CreateLeaveInput = { type: string; startDate: string; endDate: string; isHalfDay?: boolean; reason?: string | null };

export async function createLeaveRequest(actor: SessionUser, input: CreateLeaveInput) {
    const type = input.type?.toUpperCase() as LeaveType;
    if (!LEAVE_TYPES.includes(type)) throw new HttpError(400, `Leave type must be one of ${LEAVE_TYPES.join(", ")}.`);

    const start = toUtcDay(input.startDate);
    const end = toUtcDay(input.endDate);
    if (end < start) throw new HttpError(400, "End date is before start date.");
    if (start.getUTCFullYear() !== end.getUTCFullYear()) throw new HttpError(400, "Split leave that crosses a year end into two requests.");
    const isHalfDay = !!input.isHalfDay;
    if (isHalfDay && start.getTime() !== end.getTime()) throw new HttpError(400, "A half day must start and end on the same date.");

    const days = weekdaysBetween(start, end);
    if (days === 0) throw new HttpError(400, "The selected dates fall on a weekend.");
    const duration = isHalfDay ? 0.5 : days;
    const year = start.getUTCFullYear();
    const isPaid = type !== "UNPAID";

    const request = await prisma.$transaction(async tx => {
        const overlap = await tx.leaveRequest.findFirst({
            where: {
                userId: actor.id,
                status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
                startDate: { lte: end },
                endDate: { gte: start },
            },
        });
        if (overlap) throw new HttpError(409, "You already have leave requested or approved for these dates.");

        if (isPaid) {
            await ensureBalances(actor.id, year, tx);
            const balance = await tx.leaveBalance.findUnique({ where: { userId_type_year: { userId: actor.id, type, year } } });
            const pending = await tx.leaveRequest.aggregate({
                where: { userId: actor.id, type, status: LeaveStatus.PENDING, startDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
                _sum: { duration: true },
            });
            const free = (balance?.available ?? 0) - (pending._sum.duration ?? 0);
            if (free < duration) {
                throw new HttpError(400, `Not enough ${type.toLowerCase()} leave: ${free} day(s) free after pending requests, ${duration} requested.`);
            }
        }

        const created = await tx.leaveRequest.create({
            data: { userId: actor.id, type, startDate: start, endDate: end, isHalfDay, duration, isPaid, reason: input.reason ?? null, status: LeaveStatus.PENDING },
            include: { user: { select: { id: true, name: true, email: true } } },
        });
        const data = await eventData(created, tx);
        await emitEvent(tx, { type: "leave.requested", subject: { type: "LeaveRequest", id: created.id }, data, actor });
        for (const m of data.managers) {
            await notify(tx, m.id, "Leave request", `${created.user.name ?? created.user.email} requested ${duration} day(s) of ${type.toLowerCase()} leave.`, "alert");
        }
        return created;
    });

    scheduleDispatch();
    return request;
}

export type LeaveDecision = "APPROVED" | "REJECTED" | "CANCELLED";

export async function decideLeave(actor: SessionUser, requestId: string, status: LeaveDecision, opts: { origin?: string | null } = {}) {
    if (!["APPROVED", "REJECTED", "CANCELLED"].includes(status)) throw new HttpError(400, "Status must be APPROVED, REJECTED or CANCELLED.");

    const request = await prisma.leaveRequest.findUnique({ where: { id: requestId }, include: { user: { select: { id: true, name: true, email: true } } } });
    if (!request) throw new HttpError(404, "Leave request not found.");

    if (status === "CANCELLED") {
        const isOwner = request.userId === actor.id;
        if (!isOwner && !isPeopleAdmin(actor)) throw new HttpError(403, "Only the requester, HR or an admin can cancel leave.");
        if (request.status !== LeaveStatus.PENDING && request.status !== LeaveStatus.APPROVED) {
            throw new HttpError(409, `This request is already ${request.status.toLowerCase()}.`);
        }
        if (request.status === LeaveStatus.APPROVED && isOwner && !isPeopleAdmin(actor) && request.startDate <= toUtcDay(new Date())) {
            throw new HttpError(409, "This leave has already started. Ask HR to cancel it.");
        }
    } else {
        await assertCanApproveFor(actor, request.userId);
        if (request.status !== LeaveStatus.PENDING) throw new HttpError(409, `This request is already ${request.status.toLowerCase()}.`);
    }

    const year = request.startDate.getUTCFullYear();

    const updated = await prisma.$transaction(async tx => {
        // Conditional update: a concurrent decision makes count 0 and we stop.
        const fromStatus = request.status;
        const changed = await tx.leaveRequest.updateMany({
            where: { id: request.id, status: fromStatus },
            data: { status, approverId: status === "CANCELLED" && request.userId === actor.id ? request.approverId : actor.id },
        });
        if (changed.count === 0) throw new HttpError(409, "This request was changed by someone else. Reload and try again.");

        if (request.isPaid && status === "APPROVED") {
            await ensureBalances(request.userId, year, tx);
            const deducted = await tx.leaveBalance.updateMany({
                where: { userId: request.userId, type: request.type, year, available: { gte: request.duration } },
                data: { used: { increment: request.duration }, available: { decrement: request.duration } },
            });
            if (deducted.count === 0) throw new HttpError(400, "Insufficient balance for approval.");
        }
        if (request.isPaid && status === "CANCELLED" && fromStatus === LeaveStatus.APPROVED) {
            await tx.leaveBalance.updateMany({
                where: { userId: request.userId, type: request.type, year },
                data: { used: { decrement: request.duration }, available: { increment: request.duration } },
            });
        }

        const fresh = await tx.leaveRequest.findUniqueOrThrow({
            where: { id: request.id },
            include: { user: { select: { id: true, name: true, email: true } }, approver: { select: { id: true, name: true, email: true } } },
        });
        const type = status === "APPROVED" ? "leave.approved" : status === "REJECTED" ? "leave.rejected" : "leave.cancelled";
        await emitEvent(tx, { type, subject: { type: "LeaveRequest", id: fresh.id }, data: await eventData(fresh, tx), actor, origin: opts.origin });
        await audit(tx, actor.id, type, "LeaveRequest", fresh.id, { from: fromStatus, to: status, duration: fresh.duration });
        if (fresh.userId !== actor.id) {
            await notify(tx, fresh.userId, `Leave ${status.toLowerCase()}`, `Your ${fresh.type.toLowerCase()} leave from ${ymd(fresh.startDate)} to ${ymd(fresh.endDate)} was ${status.toLowerCase()}.`, status === "APPROVED" ? "success" : "alert");
        }
        return fresh;
    });

    scheduleDispatch();
    return updated;
}
