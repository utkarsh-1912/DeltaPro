import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { createGoal, listGoals } from "@/services/performance";

export const dynamic = "force-dynamic";

/** ?scope=mine|team|company&ownerId=…&cycleId=… */
export const GET = route(async ({ req, user }) => {
    const p = new URL(req.url).searchParams;
    return listGoals(user, { scope: p.get("scope"), ownerId: p.get("ownerId"), cycleId: p.get("cycleId") });
}, { feature: "performance" });

const schema = z.object({
    title: z.string().trim().min(2).max(200),
    description: z.string().max(4000).nullable().optional(),
    scope: z.enum(["INDIVIDUAL", "TEAM", "COMPANY"]).optional(),
    ownerId: z.string().optional(),
    cycleId: z.string().nullable().optional(),
    parentId: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    keyResults: z.array(z.object({ title: z.string().trim().min(1).max(200), unit: z.string().max(20).optional(), startValue: z.number().optional(), targetValue: z.number() })).max(10).optional(),
});

export const POST = route(async ({ req, user }) => Response.json(await createGoal(user, await parseBody(req, schema)), { status: 201 }), { feature: "performance" });
