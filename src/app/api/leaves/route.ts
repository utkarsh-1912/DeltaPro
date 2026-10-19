import { z } from "zod";
import { LeaveStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError, MANAGER_ROLES, assertTeamAccess, parseBody, route } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Rota leave for team members: manual entries plus approved leave requests of the linked
 * user accounts (read-only, id prefixed with "lr_"), so the rota generator skips people on leave.
 */
export const GET = route(async () => {
    const [manual, members] = await Promise.all([
        prisma.leave.findMany({ orderBy: { startDate: "asc" } }),
        prisma.teamMember.findMany({ select: { id: true, email: true, userId: true } }),
    ]);
    const memberIdsByUser = new Map<string, string[]>();
    const byEmail = new Map<string, string[]>();
    for (const m of members) {
        if (m.userId) memberIdsByUser.set(m.userId, [...(memberIdsByUser.get(m.userId) ?? []), m.id]);
        else byEmail.set(m.email.toLowerCase(), [...(byEmail.get(m.email.toLowerCase()) ?? []), m.id]);
    }
    const approved = await prisma.leaveRequest.findMany({
        where: { status: LeaveStatus.APPROVED, endDate: { gte: new Date(Date.now() - 90 * 86400000) } },
        include: { user: { select: { id: true, email: true } } },
    });
    const fromRequests = approved.flatMap(r => {
        const ids = memberIdsByUser.get(r.userId) ?? (r.user.email ? byEmail.get(r.user.email.toLowerCase()) : undefined) ?? [];
        return ids.map(memberId => ({
            id: `lr_${r.id}_${memberId}`,
            memberId,
            startDate: r.startDate.toISOString(),
            endDate: r.endDate.toISOString(),
            type: r.type,
            source: "LEAVE_REQUEST",
        }));
    });
    return [...manual, ...fromRequests];
});

const schema = z.object({
    id: z.string().optional(),
    memberId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    type: z.string().min(1).max(40),
});

export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, schema);
    const member = await prisma.teamMember.findUnique({ where: { id: body.memberId } });
    if (!member) throw new HttpError(400, "Team member not found.");
    await assertTeamAccess(user, member.teamId);
    if (new Date(body.endDate) < new Date(body.startDate)) throw new HttpError(400, "End date is before start date.");
    const leave = await prisma.leave.create({ data: { ...(body.id ? { id: body.id } : {}), memberId: body.memberId, startDate: body.startDate, endDate: body.endDate, type: body.type } });
    return Response.json(leave, { status: 201 });
}, { roles: MANAGER_ROLES });
