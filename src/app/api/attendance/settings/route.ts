import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/activity";
import { parseBody, route } from "@/lib/api";
import { getAttendanceSettings } from "@/services/attendance";

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
    const data = await parseBody(req, schema);
    const current = await getAttendanceSettings();
    const updated = await prisma.attendanceSettings.update({ where: { id: current.id }, data });
    await audit(prisma, user.id, "attendance.settings_updated", "AttendanceSettings", updated.id, data);
    return updated;
}, { roles: [Role.ADMIN, Role.HR] });
