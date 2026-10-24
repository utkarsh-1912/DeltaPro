import { MANAGER_ROLES, route } from "@/lib/api";
import { deleteRotaLeave, getRotaLeave } from "@/services/rota-admin";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ params }) => getRotaLeave(params.id));

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    await deleteRotaLeave(user, params.id);
    return { ok: true };
}, { roles: MANAGER_ROLES });
