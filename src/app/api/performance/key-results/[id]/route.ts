import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { deleteKeyResult, updateKeyResult } from "@/services/performance";

export const dynamic = "force-dynamic";

const schema = z.object({ currentValue: z.number().optional(), title: z.string().trim().min(1).max(200).optional(), targetValue: z.number().optional() });

/** Check in progress on a key result; the goal's progress is recalculated. */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => updateKeyResult(user, params.id, await parseBody(req, schema)), { feature: "performance" });

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    await deleteKeyResult(user, params.id);
    return { ok: true };
}, { feature: "performance" });
