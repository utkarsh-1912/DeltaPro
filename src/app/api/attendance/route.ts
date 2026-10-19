import { z } from "zod";
import { startOfWeek, endOfWeek, differenceInMinutes, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { HttpError, canActOnUser, parseBody, route, scopeByUser } from "@/lib/api";
import { clockIn } from "@/services/attendance";

export const dynamic = 'force-dynamic';

const WEEKLY_TARGET_MINUTES = 2400;
const WORKING_DAYS = 5;

function parseDate(v: string | null): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

async function weeklyMetrics(userId: string, anchor: Date) {
    const from = startOfWeek(anchor, { weekStartsOn: 1 });
    const to = endOfWeek(anchor, { weekStartsOn: 1 });
    const logs = await prisma.attendanceLog.findMany({ where: { userId, loginTime: { gte: from, lte: to } }, select: { loginTime: true, logoutTime: true } });
    let totalMinutes = 0;
    for (const log of logs) {
        totalMinutes += differenceInMinutes(log.logoutTime ?? new Date(), log.loginTime);
    }
    const distinctDays = new Set(logs.map(l => l.loginTime.toDateString())).size;
    return {
        weeklyTotal: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
        targetPercentage: Math.min(Math.round((totalMinutes / WEEKLY_TARGET_MINUTES) * 100), 100),
        attendanceScore: `${Math.min(Math.round((distinctDays / WORKING_DAYS) * 100), 100)}%`,
        totalMinutes,
    };
}

/**
 * GET /api/attendance
 *   ?startDate&endDate   own logs in range (or ?userId= for a report / anyone for HR/ADMIN)
 *   ?team=true           every log the caller may see (self, reports, or all), default last 7 days
 */
export const GET = route(async ({ req, user }) => {
    const { searchParams } = new URL(req.url);
    const start = parseDate(searchParams.get("startDate"));
    const end = parseDate(searchParams.get("endDate"));
    const range = start || end ? { loginTime: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {};

    if (searchParams.get("team") === "true") {
        const logs = await prisma.attendanceLog.findMany({
            where: { ...scopeByUser(user), ...(start || end ? range : { loginTime: { gte: subDays(new Date(), 7) } }) },
            include: { user: { select: { name: true, image: true, role: true } } },
            orderBy: { loginTime: "desc" },
            take: 500,
        });
        return { logs, metrics: null };
    }

    const requested = searchParams.get("userId");
    const targetId = requested && requested !== user.id ? requested : user.id;
    if (targetId !== user.id && !(await canActOnUser(user, targetId))) throw new HttpError(403, "You can only view your own attendance or your reports'.");

    const logs = await prisma.attendanceLog.findMany({
        where: { userId: targetId, ...range },
        include: { user: { select: { name: true, image: true, role: true } } },
        orderBy: { loginTime: "desc" },
        take: 500,
    });
    // The page needs to know about an open session even when it started before the selected day.
    if (!logs.some(l => !l.logoutTime)) {
        const open = await prisma.attendanceLog.findFirst({
            where: { userId: targetId, logoutTime: null },
            include: { user: { select: { name: true, image: true, role: true } } },
        });
        if (open) logs.unshift(open);
    }
    return { logs, metrics: await weeklyMetrics(targetId, start ?? new Date()) };
});

const clockInSchema = z.object({
    isWfh: z.boolean().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    accuracy: z.number().nullable().optional(),
}).passthrough();

/** Clock in. Time is set by the server; office clock-ins are checked against the geofence. */
export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, clockInSchema);
    return Response.json(await clockIn(user, body), { status: 201 });
});
