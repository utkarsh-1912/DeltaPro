import type { AttendanceLog, AttendanceSettings, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit, notify, type Db } from "@/lib/activity";
import { HttpError, assertCanApproveFor, isPeopleAdmin, type SessionUser } from "@/lib/api";
import { emitEvent, scheduleDispatch, type EventType } from "@/integrations/events";
import { approversFor, haversineMeters, managerOf, person } from "./shared";

const HOUR = 3600 * 1000;
const REGULARIZED_DAY_HOURS = 9;
export const REGULARIZATION_TYPES = ["CLOCK_IN", "CLOCK_OUT", "FULL_DAY"] as const;

export async function getAttendanceSettings(db: Db = prisma): Promise<AttendanceSettings> {
    const existing = await db.attendanceSettings.findFirst();
    return existing ?? db.attendanceSettings.create({ data: {} });
}

type Person = Pick<User, "id" | "name" | "email">;

async function emitLog(db: Db, type: EventType, log: AttendanceLog, user: Person, actor: SessionUser | null, extra: Record<string, unknown> = {}) {
    await emitEvent(db, {
        type,
        subject: { type: "AttendanceLog", id: log.id },
        actor,
        data: {
            log: {
                id: log.id,
                loginTime: log.loginTime.toISOString(),
                logoutTime: log.logoutTime?.toISOString() ?? null,
                isWfh: log.isWfh,
                location: log.loginLocation,
                distanceMeters: log.distanceMeters,
                source: log.source,
                reason: log.autoLogoutReason,
            },
            user: person(user),
            manager: await managerOf(user.id, db),
            ...extra,
        },
    });
}

export type Coordinates = { latitude?: number | null; longitude?: number | null; accuracy?: number | null };

export async function clockIn(actor: SessionUser, input: Coordinates & { isWfh?: boolean }) {
    const settings = await getAttendanceSettings();
    const isWfh = !!input.isWfh;
    let distanceMeters: number | null = null;

    if (isWfh) {
        if (!settings.wfhAllowed) throw new HttpError(403, "Work from home is turned off. Clock in from the office.");
    } else if (settings.geofencingEnabled) {
        if (input.latitude == null || input.longitude == null) throw new HttpError(400, "Location is required to clock in at the office. Allow location access and try again.");
        if (input.accuracy != null && input.accuracy > settings.maxAccuracyMeters) {
            throw new HttpError(422, `Your location is only accurate to ${Math.round(input.accuracy)} m (limit ${settings.maxAccuracyMeters} m). Move near a window or retry.`);
        }
        distanceMeters = haversineMeters(input.latitude, input.longitude, settings.officeLat, settings.officeLng);
        if (distanceMeters > settings.allowedRadius) {
            throw new HttpError(422, `You are ${Math.round(distanceMeters)} m from the office; the limit is ${settings.allowedRadius} m. Switch to WFH or move closer.`);
        }
    }

    const log = await prisma.$transaction(async tx => {
        const open = await tx.attendanceLog.findFirst({ where: { userId: actor.id, logoutTime: null } });
        if (open) throw new HttpError(409, "You are already clocked in. Clock out first.");
        const created = await tx.attendanceLog.create({
            data: {
                userId: actor.id,
                loginTime: new Date(),
                loginLocation: isWfh ? "Remote / Home" : "Corporate Office",
                latitude: input.latitude ?? null,
                longitude: input.longitude ?? null,
                accuracy: input.accuracy ?? null,
                distanceMeters,
                isWfh,
                status: "LOGGED_IN",
                source: "WEB",
            },
            include: { user: { select: { id: true, name: true, email: true } } },
        });
        await emitLog(tx, "attendance.clocked_in", created, created.user, actor);
        return created;
    });
    scheduleDispatch();
    return log;
}

export async function clockOut(actor: SessionUser, logId: string, input: Coordinates & { reason?: string | null }) {
    const log = await prisma.attendanceLog.findUnique({ where: { id: logId }, include: { user: { select: { id: true, name: true, email: true } } } });
    if (!log) throw new HttpError(404, "Attendance log not found.");
    if (log.userId !== actor.id && !isPeopleAdmin(actor)) throw new HttpError(403, "You can only clock out your own session.");
    if (log.logoutTime) throw new HttpError(409, "This session is already closed.");

    let auto = false;
    if (input.reason === "OUT_OF_RANGE") {
        const settings = await getAttendanceSettings();
        if (log.isWfh || !settings.geofencingEnabled || !settings.autoLogoutOutOfRange) throw new HttpError(400, "Automatic clock-out does not apply to this session.");
        if (input.latitude == null || input.longitude == null) throw new HttpError(400, "Location is required.");
        const dist = haversineMeters(input.latitude, input.longitude, settings.officeLat, settings.officeLng);
        if (dist <= settings.allowedRadius) throw new HttpError(409, "You are still inside the office radius.");
        auto = true;
    }

    const closed = await prisma.$transaction(async tx => {
        const changed = await tx.attendanceLog.updateMany({
            where: { id: log.id, logoutTime: null },
            data: {
                logoutTime: new Date(),
                logoutLocation: log.isWfh ? "Remote / Home" : auto ? "Left office radius" : "Corporate Office",
                logoutLatitude: input.latitude ?? null,
                logoutLongitude: input.longitude ?? null,
                status: auto ? "AUTO_LOGOUT" : "LOGGED_OUT",
                autoLogoutReason: auto ? "OUT_OF_RANGE" : null,
            },
        });
        if (changed.count === 0) throw new HttpError(409, "This session is already closed.");
        const fresh = await tx.attendanceLog.findUniqueOrThrow({ where: { id: log.id } });
        await emitLog(tx, auto ? "attendance.auto_logged_out" : "attendance.clocked_out", fresh, log.user, actor);
        return fresh;
    });
    scheduleDispatch();
    return closed;
}

/** Close sessions left open longer than settings.autoLogoutHours. Run from cron. */
export async function autoLogoutStale(now = new Date()) {
    const settings = await getAttendanceSettings();
    const cutoff = new Date(now.getTime() - settings.autoLogoutHours * HOUR);
    const stale = await prisma.attendanceLog.findMany({
        where: { logoutTime: null, loginTime: { lt: cutoff } },
        include: { user: { select: { id: true, name: true, email: true } } },
        take: 500,
    });
    let closed = 0;
    for (const log of stale) {
        await prisma.$transaction(async tx => {
            const changed = await tx.attendanceLog.updateMany({
                where: { id: log.id, logoutTime: null },
                data: {
                    logoutTime: new Date(log.loginTime.getTime() + settings.autoLogoutHours * HOUR),
                    logoutLocation: "Auto clock-out",
                    status: "AUTO_LOGOUT",
                    autoLogoutReason: "MAX_HOURS",
                },
            });
            if (changed.count === 0) return;
            closed++;
            const fresh = await tx.attendanceLog.findUniqueOrThrow({ where: { id: log.id } });
            await emitLog(tx, "attendance.auto_logged_out", fresh, log.user, null, { maxHours: settings.autoLogoutHours });
            await notify(tx, log.userId, "Clocked out automatically", `Your session from ${log.loginTime.toISOString().slice(0, 16).replace("T", " ")} UTC ran past ${settings.autoLogoutHours} hours. Submit a correction if needed.`, "alert");
        });
    }
    if (closed) scheduleDispatch();
    return { closed };
}

/** A punch from an attendance device. AUTO toggles based on whether a session is open. */
export async function recordPunch(userId: string, at: Date, direction: "IN" | "OUT" | "AUTO", deviceId?: string, origin?: string) {
    if (Number.isNaN(at.getTime())) throw new HttpError(400, "Invalid timestamp");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true } });
    return prisma.$transaction(async tx => {
        const open = await tx.attendanceLog.findFirst({ where: { userId, logoutTime: null }, orderBy: { loginTime: "desc" } });
        const dir = direction === "AUTO" ? (open ? "OUT" : "IN") : direction;
        if (dir === "IN") {
            if (open) return { ok: true, message: "Already clocked in; punch ignored." };
            const log = await tx.attendanceLog.create({
                data: { userId, loginTime: at, loginLocation: deviceId ? `Device ${deviceId}` : "Device", status: "LOGGED_IN", source: "DEVICE" },
            });
            await emitLog(tx, "attendance.clocked_in", log, user, null, { origin });
            return { ok: true, message: `Clocked in at ${at.toISOString()}` };
        }
        if (!open) return { ok: false, message: "No open session to clock out." };
        if (at < open.loginTime) return { ok: false, message: "Punch-out is earlier than the open clock-in." };
        const log = await tx.attendanceLog.update({
            where: { id: open.id },
            data: { logoutTime: at, logoutLocation: deviceId ? `Device ${deviceId}` : "Device", status: "LOGGED_OUT" },
        });
        await emitLog(tx, "attendance.clocked_out", log, user, null, { origin });
        return { ok: true, message: `Clocked out at ${at.toISOString()}` };
    });
}

// ---------- Regularisation ----------

export async function createRegularization(actor: SessionUser, input: { type: string; date: string; reason: string }) {
    if (!REGULARIZATION_TYPES.includes(input.type as any)) throw new HttpError(400, `Type must be one of ${REGULARIZATION_TYPES.join(", ")}.`);
    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) throw new HttpError(400, "Invalid date.");
    if (date.getTime() > Date.now()) throw new HttpError(400, "You can only correct past attendance.");
    if (!input.reason || input.reason.trim().length < 3) throw new HttpError(400, "Give a reason for the correction.");

    const dayStart = new Date(date.getTime() - 12 * HOUR);
    const dayEnd = new Date(date.getTime() + 12 * HOUR);

    const created = await prisma.$transaction(async tx => {
        const dup = await tx.attendanceRequest.findFirst({ where: { userId: actor.id, status: "PENDING", type: input.type, date: { gte: dayStart, lte: dayEnd } } });
        if (dup) throw new HttpError(409, "You already have a pending correction for this date.");
        const req = await tx.attendanceRequest.create({
            data: { userId: actor.id, type: input.type, date, reason: input.reason.trim() },
            include: { user: { select: { id: true, name: true, email: true } } },
        });
        const managers = await approversFor(actor.id, tx);
        await emitEvent(tx, {
            type: "attendance.regularization_requested",
            subject: { type: "AttendanceRequest", id: req.id },
            actor,
            data: { request: { id: req.id, type: req.type, date: req.date.toISOString(), reason: req.reason, status: req.status }, user: person(req.user), managers },
        });
        for (const m of managers) await notify(tx, m.id, "Attendance correction", `${req.user.name ?? req.user.email} asked to correct ${req.type.toLowerCase().replace("_", " ")}.`, "alert");
        return req;
    });
    scheduleDispatch();
    return created;
}

export async function decideRegularization(actor: SessionUser, id: string, status: "APPROVED" | "REJECTED", opts: { origin?: string | null } = {}) {
    if (status !== "APPROVED" && status !== "REJECTED") throw new HttpError(400, "Status must be APPROVED or REJECTED.");
    const req = await prisma.attendanceRequest.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, email: true } } } });
    if (!req) throw new HttpError(404, "Request not found.");
    await assertCanApproveFor(actor, req.userId);
    if (req.status !== "PENDING") throw new HttpError(409, `This request is already ${req.status.toLowerCase()}.`);

    const updated = await prisma.$transaction(async tx => {
        const changed = await tx.attendanceRequest.updateMany({ where: { id, status: "PENDING" }, data: { status, approverId: actor.id } });
        if (changed.count === 0) throw new HttpError(409, "This request was changed by someone else.");

        if (status === "APPROVED") await applyRegularization(tx, req.userId, req.type, req.date);

        const fresh = await tx.attendanceRequest.findUniqueOrThrow({ where: { id }, include: { approver: { select: { id: true, name: true, email: true } } } });
        await emitEvent(tx, {
            type: "attendance.regularization_decided",
            subject: { type: "AttendanceRequest", id },
            actor,
            origin: opts.origin,
            data: { request: { id, type: fresh.type, date: fresh.date.toISOString(), reason: fresh.reason, status }, user: person(req.user), approver: person(fresh.approver) },
        });
        await audit(tx, actor.id, `attendance.regularization_${status.toLowerCase()}`, "AttendanceRequest", id);
        await notify(tx, req.userId, `Attendance correction ${status.toLowerCase()}`, `Your ${req.type.toLowerCase().replace("_", " ")} correction was ${status.toLowerCase()}.`, status === "APPROVED" ? "success" : "alert");
        return fresh;
    });
    scheduleDispatch();
    return updated;
}

/** Turn an approved correction into attendance log changes. */
async function applyRegularization(tx: Db, userId: string, type: string, at: Date) {
    const dayStart = new Date(at.getTime() - 12 * HOUR);
    const dayEnd = new Date(at.getTime() + 12 * HOUR);
    const sameDay = await tx.attendanceLog.findMany({ where: { userId, loginTime: { gte: dayStart, lte: dayEnd } }, orderBy: { loginTime: "asc" } });
    const base = { userId, loginLocation: "Regularization", source: "REGULARIZATION", status: "LOGGED_OUT" };

    if (type === "FULL_DAY") {
        await tx.attendanceLog.create({ data: { ...base, loginTime: at, logoutTime: new Date(at.getTime() + REGULARIZED_DAY_HOURS * HOUR) } });
    } else if (type === "CLOCK_IN") {
        const first = sameDay[0];
        if (first) await tx.attendanceLog.update({ where: { id: first.id }, data: { loginTime: at } });
        else await tx.attendanceLog.create({ data: { ...base, loginTime: at, logoutTime: new Date(at.getTime() + REGULARIZED_DAY_HOURS * HOUR) } });
    } else if (type === "CLOCK_OUT") {
        const last = sameDay[sameDay.length - 1];
        if (last && last.loginTime < at) {
            await tx.attendanceLog.update({ where: { id: last.id }, data: { logoutTime: at, status: "LOGGED_OUT", autoLogoutReason: null } });
        } else {
            await tx.attendanceLog.create({ data: { ...base, loginTime: new Date(at.getTime() - REGULARIZED_DAY_HOURS * HOUR), logoutTime: at } });
        }
    }
}
