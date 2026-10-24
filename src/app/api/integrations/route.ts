import { z } from "zod";
import { Role } from "@prisma/client";
import { parseBody, route } from "@/lib/api";
import { createIntegration, listIntegrations } from "@/integrations/manage";

export const dynamic = "force-dynamic";

export const GET = route(async ({ org }) => listIntegrations(org), { roles: [Role.ADMIN] });

const schema = z.object({
    provider: z.string(),
    name: z.string().trim().min(1).max(100),
    enabled: z.boolean().default(true),
    config: z.record(z.any()).default({}),
    credentials: z.record(z.any()).default({}),
    events: z.array(z.string()).optional(),
});

export const POST = route(async ({ req, user, org }) => Response.json(await createIntegration(user, org, await parseBody(req, schema)), { status: 201 }), { roles: [Role.ADMIN] });
