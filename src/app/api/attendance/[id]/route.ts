import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { clockOut } from "@/services/attendance";
import { getLog } from "@/services/attendance-queries";

export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async ({ user, params }) => getLog(user, params.id));

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
