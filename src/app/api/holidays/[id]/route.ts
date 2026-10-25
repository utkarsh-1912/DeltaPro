import { PEOPLE_ADMIN_ROLES, route } from "@/lib/api";
import { deleteHoliday } from "@/services/holidays";

export const dynamic = "force-dynamic";

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    await deleteHoliday(user, params.id);
    return { ok: true };
}, { roles: PEOPLE_ADMIN_ROLES });
