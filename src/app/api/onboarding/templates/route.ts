import { z } from "zod";
import { PEOPLE_ADMIN_ROLES, parseBody, route } from "@/lib/api";
import { listTemplates, saveTemplate } from "@/services/onboarding";

export const dynamic = "force-dynamic";

export const GET = route(async () => listTemplates(), { feature: "onboarding" });

const schema = z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(100),
    kind: z.enum(["ONBOARDING", "OFFBOARDING"]),
    items: z.array(z.object({ title: z.string().trim().min(1).max(200), owner: z.enum(["HR", "MANAGER", "EMPLOYEE", "IT"]), dueOffsetDays: z.number().int().min(-90).max(180) })).min(1).max(50),
});

export const POST = route(async ({ req, user }) => saveTemplate(user, await parseBody(req, schema)), { roles: PEOPLE_ADMIN_ROLES, feature: "onboarding" });
