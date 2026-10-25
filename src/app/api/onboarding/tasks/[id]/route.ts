import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { reassignTask, setTaskDone } from "@/services/onboarding";

export const dynamic = "force-dynamic";

const schema = z.object({ done: z.boolean().optional(), assigneeId: z.string().optional() });

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
    const body = await parseBody(req, schema);
    if (body.assigneeId) await reassignTask(user, params.id, body.assigneeId);
    if (body.done !== undefined) return setTaskDone(user, params.id, body.done);
    return { ok: true };
}, { feature: "onboarding" });
