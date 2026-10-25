import { PEOPLE_ADMIN_ROLES, route } from "@/lib/api";
import { deleteTemplate } from "@/services/onboarding";

export const dynamic = "force-dynamic";

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    await deleteTemplate(user, params.id);
    return { ok: true };
}, { roles: PEOPLE_ADMIN_ROLES, feature: "onboarding" });
