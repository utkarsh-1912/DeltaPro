import { z } from "zod";
import { MANAGER_ROLES, parseBody, route } from "@/lib/api";
import { deleteMember, getMember, updateMember } from "@/services/rota-admin";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ params }) => getMember(params.id));

const schema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    email: z.string().email().optional(),
    teamId: z.string().nullable().optional(),
    fixedShiftId: z.string().nullable().optional(),
    lastShiftId: z.string().nullable().optional(),
});

export const PUT = route<{ id: string }>(async ({ req, user, params }) => updateMember(user, params.id, await parseBody(req, schema)), { roles: MANAGER_ROLES });

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    await deleteMember(user, params.id);
    return { ok: true };
}, { roles: MANAGER_ROLES });
