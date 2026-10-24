import { differenceInMinutes, endOfWeek, startOfWeek, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/activity";
import { HttpError, canActOnUser, scopeByUser, type SessionUser } from "@/lib/api";
import { getAttendanceSettings } from "./attendance";

const WEEKLY_TARGET_MINUTES = 2400;
const WORKING_DAYS = 5;
const USER_SELECT = { select: { name: true, image: true, role: true } } as const;

export type DateRange = { start: Date | null; end: Date | null };

const rangeWhere = ({ start, end }: DateRange) =>
    start || end ? { loginTime: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {};

export async function weeklyMetrics(userId: string, anchor: Date) {
    const from = startOfWeek(anchor, { weekStartsOn: 1 });
    const to = endOfWeek(anchor, { weekStartsOn: 1 });
    const logs = await prisma.attendanceLog.findMany({ where: { userId, loginTime: { gte: from, lte: to } }, select: { loginTime: true, logoutTime: true } });
    let totalMinutes = 0;
    for (const log of logs) totalMinutes += differenceInMinutes(log.logoutTime ?? new Date(), log.loginTime);
    const distinctDays = new Set(logs.map(l => l.loginTime.toDateString())).size;
    return {
        weeklyTotal: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
        targetPercentage: Math.min(Math.round((totalMinutes / WEEKLY_TARGET_MINUTES) * 100), 100),
        attendanceScore: `${Math.min(Math.round((distinctDays / WORKING_DAYS) * 100), 100)}%`,
        totalMinutes,
    };
}

/** Every log the actor may see (self, reports, or everyone for HR/ADMIN); defaults to the last 7 days. */
export async function listTeamLogs(actor: SessionUser, range: DateRange) {
    const logs = await prisma.attendanceLog.findMany({
        where: { ...scopeByUser(actor), ...(range.start || range.end ? rangeWhere(range) : { loginTime: { gte: subDays(new Date(), 7) } }) },
        include: { user: USER_SELECT },
        orderBy: { loginTime: "desc" },
        take: 500,
    });
    return { logs, metrics: null };
}

/** One person's logs in range plus any open session, with weekly metrics. */
export async function listPersonLogs(actor: SessionUser, requestedUserId: string | null, range: DateRange) {
    const targetId = requestedUserId && requestedUserId !== actor.id ? requestedUserId : actor.id;
    if (targetId !== actor.id && !(await canActOnUser(actor, targetId))) throw new HttpError(403, "You can only view your own attendance or your reports'.");
    const logs = await prisma.attendanceLog.findMany({
        where: { userId: targetId, ...rangeWhere(range) },
        include: { user: USER_SELECT },
        orderBy: { loginTime: "desc" },
        take: 500,
    });
    if (!logs.some(l => !l.logoutTime)) {
        const open = await prisma.attendanceLog.findFirst({ where: { userId: targetId, logoutTime: null }, include: { user: USER_SELECT } });
        if (open) logs.unshift(open);
    }
    return { logs, metrics: await weeklyMetrics(targetId, range.start ?? new Date()) };
}

export async function getLog(actor: SessionUser, id: string) {
    const log = await prisma.attendanceLog.findUnique({ where: { id } });
    if (!log) throw new HttpError(404, "Attendance log not found.");
    if (!(await canActOnUser(actor, log.userId))) throw new HttpError(403, "Forbidden");
    return log;
}

export async function listRegularizations(actor: SessionUser, userId: string | null) {
    if (userId && !(await canActOnUser(actor, userId))) throw new HttpError(403, "Forbidden");
    return prisma.attendanceRequest.findMany({
        where: userId ? { userId } : scopeByUser(actor),
        include: { user: USER_SELECT, approver: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
    });
}

export async function updateAttendanceSettings(actor: SessionUser, data: Record<string, unknown>) {
    const current = await getAttendanceSettings();
    const updated = await prisma.attendanceSettings.update({ where: { id: current.id }, data });
    await audit(prisma, actor.id, "attendance.settings_updated", "AttendanceSettings", updated.id, data as any);
    return updated;
}

export async function listLeaveRequests(actor: SessionUser, userId: string | null) {
    if (userId && !(await canActOnUser(actor, userId))) throw new HttpError(403, "Forbidden");
    return prisma.leaveRequest.findMany({
        where: userId ? { userId } : scopeByUser(actor),
        include: { user: USER_SELECT, approver: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
    });
}
