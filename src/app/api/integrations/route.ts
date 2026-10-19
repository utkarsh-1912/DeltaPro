import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/activity";
import { parseBody, route } from "@/lib/api";
import { EVENT_TYPES } from "@/integrations/events";
import { catalog } from "@/integrations/registry";
import { encryptCredentials, serializeIntegration, validateEvents, validateFields } from "@/integrations/admin";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
    const integrations = await prisma.integration.findMany({ orderBy: { createdAt: "asc" } });
    return {
        integrations: await Promise.all(integrations.map(serializeIntegration)),
        catalog: catalog(),
        eventTypes: EVENT_TYPES.filter(e => e !== "integration.test"),
    };
}, { roles: [Role.ADMIN] });

const schema = z.object({
    provider: z.string(),
    name: z.string().trim().min(1).max(100),
    enabled: z.boolean().default(true),
    config: z.record(z.any()).default({}),
    credentials: z.record(z.any()).default({}),
    events: z.array(z.string()).optional(),
});

export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, schema);
    const { config, credentials } = validateFields(body.provider, body.config, body.credentials);
    const integration = await prisma.integration.create({
        data: {
            provider: body.provider,
            name: body.name,
            enabled: body.enabled,
            config,
            credentials: encryptCredentials(credentials),
            events: validateEvents(body.provider, body.events),
            createdById: user.id,
        },
    });
    await audit(prisma, user.id, "integration.created", "Integration", integration.id, { provider: integration.provider });
    return Response.json(await serializeIntegration(integration), { status: 201 });
}, { roles: [Role.ADMIN] });
