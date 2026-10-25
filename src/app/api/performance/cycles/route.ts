import { z } from "zod";
import { PEOPLE_ADMIN_ROLES, parseBody, route } from "@/lib/api";
import { createCycle, listCycles } from "@/services/performance";

export const dynamic = "force-dynamic";

export const GET = route(async () => listCycles(), { feature: "performance" });

const schema = z.object({
    name: z.string().trim().min(2).max(100),
    startDate: z.string(),
    endDate: z.string(),
    includeSelf: z.boolean().optional(),
    includeManager: z.boolean().optional(),
    includePeer: z.boolean().optional(),
    questions: z.array(z.object({ id: z.string().min(1).max(40), text: z.string().trim().min(3).max(300) })).max(10).optional(),
});

export const POST = route(async ({ req, user }) => Response.json(await createCycle(user, await parseBody(req, schema)), { status: 201 }), { roles: PEOPLE_ADMIN_ROLES, feature: "performance" });
