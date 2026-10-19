import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError, publicRoute } from "@/lib/api";
import { buildContext } from "@/integrations/context";
import { executeCommands } from "@/integrations/commands";
import { getConnector } from "@/integrations/registry";

export const dynamic = "force-dynamic";

/**
 * Inbound endpoint for one integration (Slack interactivity, Jira/GitHub/HRIS webhooks, device punches).
 * Verify → de-duplicate → map to commands → apply through the same services the UI uses.
 */
export const POST = publicRoute<{ id: string }>(async ({ req, params }) => {
    const integration = await prisma.integration.findUnique({ where: { id: params.id } });
    const connector = integration && getConnector(integration.provider);
    if (!integration || !integration.enabled || !connector?.receive) throw new HttpError(404, "Not found");

    const rawBody = await req.text();
    const inbound = { headers: req.headers, rawBody, url: new URL(req.url) };
    const ctx = buildContext(integration);
    if (connector.verify && !(await connector.verify(inbound, ctx))) throw new HttpError(401, "Signature check failed");

    const result = await connector.receive(inbound, ctx);
    if (result.response) return result.response;

    if (result.deliveryId) {
        try {
            await prisma.inboundEvent.create({ data: { id: `${integration.id}:${result.deliveryId}`.slice(0, 190), provider: integration.provider } });
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: true, duplicate: true };
            throw e;
        }
    }

    const results = await executeCommands(result.commands, integration);
    const custom = result.onResult ? await result.onResult(results) : undefined;
    return custom ?? { ok: results.every(r => r.ok), results };
});
