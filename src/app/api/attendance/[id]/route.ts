import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, canActOnUser, parseBody, route } from "@/lib/api";
import { clockOut } from "@/services/attendance";

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async ({ user, params }) => {
    const log = await prisma.attendanceLog.findUnique({ where: { id: params.id } });
    if (!log) throw new HttpError(404, "Attendance log not found.");
    if (!(await canActOnUser(user, log.userId))) throw new HttpError(403, "Forbidden");
    return log;
});

const clockOutSchema = z.object({
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    accuracy: z.number().nullable().optional(),
    reason: z.enum(["OUT_OF_RANGE"]).nullable().optional(),
}).passthrough();

/** Clock out. reason=OUT_OF_RANGE records an automatic clock-out after the server re-checks the geofence. */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
    const body = await parseBody(req, clockOutSchema);
    return clockOut(user, params.id, body);
});
