import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { addKeyResult, deleteGoal, updateGoal } from "@/services/performance";

export const dynamic = "force-dynamic";

const schema = z.object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().max(4000).nullable().optional(),
    status: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK", "COMPLETED"]).optional(),
    progress: z.number().min(0).max(100).optional(),
    parentId: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    addKeyResult: z.object({ title: z.string().trim().min(1).max(200), unit: z.string().max(20).optional(), startValue: z.number().optional(), targetValue: z.number() }).optional(),
});

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
    const { addKeyResult: newKr, ...patch } = await parseBody(req, schema);
    if (newKr) await addKeyResult(user, params.id, newKr);
    return updateGoal(user, params.id, patch);
}, { feature: "performance" });

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    await deleteGoal(user, params.id);
    return { ok: true };
}, { feature: "performance" });
