import { z } from "zod";
import { MANAGER_ROLES, parseBody, route } from "@/lib/api";
import { deleteRota, getRota, updateRota } from "@/services/rota-admin";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ params }) => getRota(params.id));

const json = z.any().optional();
const schema = z.object({
    assignments: z.record(z.string().nullable().optional()).optional(),
    manualOverrides: json,
    manualSwaps: json,
    manualWeekendSwaps: json,
    comments: json,
    adhoc: json,
});

/** Partial update from the rota editor (assignments, swaps, comments, ad-hoc support). */
export const PUT = route<{ id: string }>(async ({ req, user, params }) => updateRota(user, params.id, await parseBody(req, schema)), { roles: MANAGER_ROLES });

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    await deleteRota(user, params.id);
    return { ok: true };
}, { roles: MANAGER_ROLES });
