import { z } from "zod";
import { Role } from "@prisma/client";
import { parseBody, route } from "@/lib/api";
import { getAttendanceSettings } from "@/services/attendance";
import { updateAttendanceSettings } from "@/services/attendance-queries";

export const dynamic = 'force-dynamic';

export const GET = route(async () => getAttendanceSettings());

const schema = z.object({
    geofencingEnabled: z.boolean().optional(),
    officeLat: z.number().min(-90).max(90).optional(),
    officeLng: z.number().min(-180).max(180).optional(),
    allowedRadius: z.number().int().min(10).max(50000).optional(),
    wfhAllowed: z.boolean().optional(),
    maxAccuracyMeters: z.number().int().min(5).max(5000).optional(),
    autoLogoutHours: z.number().int().min(1).max(24).optional(),
    autoLogoutOutOfRange: z.boolean().optional(),
}).strip();

export const PATCH = route(async ({ req, user }) => {
    return updateAttendanceSettings(user, await parseBody(req, schema));
}, { roles: [Role.ADMIN, Role.HR] });
