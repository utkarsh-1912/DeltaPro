import { z } from "zod";
import { MANAGER_ROLES, parseBody, route } from "@/lib/api";
import { deleteTeam, getTeam, updateTeam } from "@/services/rota-admin";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ params }) => getTeam(params.id));

const schema = z.object({ name: z.string().trim().min(1).max(100).optional(), pmId: z.string().nullable().optional() });

export const PUT = route<{ id: string }>(async ({ req, user, params }) => updateTeam(user, params.id, await parseBody(req, schema)), { roles: MANAGER_ROLES });

/** Deletes shifts and rotas with the team; members stay and become unassigned. */
export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    await deleteTeam(user, params.id);
    return { ok: true };
}, { roles: MANAGER_ROLES });
