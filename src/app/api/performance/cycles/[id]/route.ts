import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { closeCycle, cycleReviews, launchCycle } from "@/services/performance";

export const dynamic = "force-dynamic";

/** Every review in the cycle the caller may see (HR: all; managers: their reports). */
export const GET = route<{ id: string }>(async ({ user, params }) => cycleReviews(user, params.id), { feature: "performance" });

const schema = z.object({ action: z.enum(["launch", "close"]) });

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
    const { action } = await parseBody(req, schema);
    return action === "launch" ? launchCycle(user, params.id) : closeCycle(user, params.id);
}, { roles: ["ADMIN", "HR"], feature: "performance" });
