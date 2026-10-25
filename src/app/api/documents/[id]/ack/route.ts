import { PEOPLE_ADMIN_ROLES, route } from "@/lib/api";
import { acknowledgeDocument, acknowledgementReport } from "@/services/documents";

export const dynamic = "force-dynamic";

/** Acknowledge a policy as the signed-in user. */
export const POST = route<{ id: string }>(async ({ user, params }) => acknowledgeDocument(user, params.id));

/** HR: who has and hasn't acknowledged. */
export const GET = route<{ id: string }>(async ({ user, params }) => acknowledgementReport(user, params.id), { roles: PEOPLE_ADMIN_ROLES });
