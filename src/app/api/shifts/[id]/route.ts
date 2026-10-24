import { z } from "zod";
import { MANAGER_ROLES, parseBody, route } from "@/lib/api";
import { deleteShift, getShift, updateShift } from "@/services/rota-admin";

export const dynamic = "force-dynamic";
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

export const GET = route<{ id: string }>(async ({ params }) => getShift(params.id));

const schema = z.object({
    name: z.string().trim().min(1).max(60).optional(),
    startTime: time.optional(),
    endTime: time.optional(),
    sequence: z.number().int().min(0).optional(),
    isExtreme: z.boolean().optional(),
    minTeam: z.number().int().min(0).optional(),
    maxTeam: z.number().int().min(0).optional(),
    color: z.string().optional(),
}).strip();

export const PUT = route<{ id: string }>(async ({ req, user, params }) => updateShift(user, params.id, await parseBody(req, schema)), { roles: MANAGER_ROLES });

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    await deleteShift(user, params.id);
    return { ok: true };
}, { roles: MANAGER_ROLES });
