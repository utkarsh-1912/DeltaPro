import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { giveFeedback, listFeedback } from "@/services/performance";

export const dynamic = "force-dynamic";

export const GET = route(async ({ user }) => listFeedback(user), { feature: "performance" });

const schema = z.object({
    toId: z.string(),
    body: z.string().trim().min(3).max(2000),
    kind: z.enum(["PRAISE", "CONSTRUCTIVE"]).optional(),
    visibility: z.enum(["PRIVATE", "PUBLIC"]).optional(),
});

export const POST = route(async ({ req, user }) => Response.json(await giveFeedback(user, await parseBody(req, schema)), { status: 201 }), { feature: "performance" });
