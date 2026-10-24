import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { clockIn } from "@/services/attendance";
import { listPersonLogs, listTeamLogs } from "@/services/attendance-queries";

export const dynamic = 'force-dynamic';

function parseDate(v: string | null): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * GET /api/attendance
 *   ?startDate&endDate   own logs in range (or ?userId= for a report / anyone for HR/ADMIN)
 *   ?team=true           every log the caller may see (self, reports, or all), default last 7 days
 */
export const GET = route(async ({ req, user }) => {
    const { searchParams } = new URL(req.url);
    const range = { start: parseDate(searchParams.get("startDate")), end: parseDate(searchParams.get("endDate")) };
    if (searchParams.get("team") === "true") return listTeamLogs(user, range);
    return listPersonLogs(user, searchParams.get("userId"), range);
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
