import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/activity";
import { HttpError, parseBody, route } from "@/lib/api";
import { decryptJson } from "@/integrations/crypto";
import { encryptCredentials, serializeIntegration, validateEvents, validateFields } from "@/integrations/admin";

export const dynamic = "force-dynamic";

async function load(id: string) {
    const i = await prisma.integration.findUnique({ where: { id } });
    if (!i) throw new HttpError(404, "Integration not found.");
    return i;
}

export const GET = route<{ id: string }>(async ({ params }) => serializeIntegration(await load(params.id)), { roles: [Role.ADMIN] });

const schema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    enabled: z.boolean().optional(),
    config: z.record(z.any()).optional(),
    /** Empty strings keep the stored value; null clears it. */
    credentials: z.record(z.any()).optional(),
    events: z.array(z.string()).optional(),
});

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
    const current = await load(params.id);
    const body = await parseBody(req, schema);
    const { config, credentials } = validateFields(
        current.provider,
        { ...(current.config as Record<string, any>), ...(body.config ?? {}) },
        body.credentials ?? {},
        decryptJson(current.credentials),
    );
    const updated = await prisma.integration.update({
        where: { id: params.id },
        data: {
            name: body.name,
            enabled: body.enabled,
            config,
            credentials: encryptCredentials(credentials),
            events: body.events ? validateEvents(current.provider, body.events) : undefined,
        },
    });
    await audit(prisma, user.id, "integration.updated", "Integration", updated.id, { enabled: updated.enabled, events: updated.events });
    return serializeIntegration(updated);
}, { roles: [Role.ADMIN] });

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    const current = await load(params.id);
    await prisma.integration.delete({ where: { id: params.id } });
    await audit(prisma, user.id, "integration.deleted", "Integration", params.id, { provider: current.provider, name: current.name });
    return { ok: true };
}, { roles: [Role.ADMIN] });
