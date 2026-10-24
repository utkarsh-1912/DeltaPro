import { Prisma, type Organization } from "@prisma/client";
import { prisma, rootPrisma } from "@/lib/prisma";
import { audit } from "@/lib/activity";
import { HttpError, assertFeature, type SessionUser } from "@/lib/api";
import { runAsSystem, runWithTenant } from "@/server/context";
import { connectorFeature, hasFeature } from "@/server/plans";
import { buildContext } from "./context";
import { decryptJson, signToken, verifyToken } from "./crypto";
import { EVENT_TYPES } from "./events";
import { appBaseUrl } from "./http";
import { catalog, getConnector } from "./registry";
import { executeCommands } from "./commands";
import { retryDelivery } from "./dispatcher";
import { encryptCredentials, runPullSync, serializeIntegration, testIntegration, validateEvents, validateFields } from "./admin";

// Application service for the Integrations admin screen, OAuth and inbound webhooks.
// Tenant scoping comes from the scoped client: an admin only ever sees their own organization's rows.

const OAUTH_REDIRECT = () => `${appBaseUrl()}/api/oauth/callback`;

async function load(id: string) {
    const i = await prisma.integration.findUnique({ where: { id } });
    if (!i) throw new HttpError(404, "Integration not found.");
    return i;
}

export async function listIntegrations(org: Organization) {
    const integrations = await prisma.integration.findMany({ orderBy: { createdAt: "asc" } });
    return {
        integrations: await Promise.all(integrations.map(serializeIntegration)),
        catalog: catalog().map(c => {
            const feature = connectorFeature(c.provider);
            return { ...c, locked: !!feature && !hasFeature(org.plan, feature), requiredFeature: feature };
        }),
        eventTypes: EVENT_TYPES.filter(e => e !== "integration.test"),
    };
}

export type IntegrationInput = {
    provider: string; name: string; enabled?: boolean; config: Record<string, any>; credentials: Record<string, any>; events?: string[];
};

export async function createIntegration(actor: SessionUser, org: Organization, input: IntegrationInput) {
    const feature = connectorFeature(input.provider);
    if (feature) assertFeature(org, feature);
    const { config, credentials } = validateFields(input.provider, input.config, input.credentials);
    const integration = await prisma.integration.create({
        data: {
            provider: input.provider,
            name: input.name,
            enabled: input.enabled ?? true,
            config,
            credentials: encryptCredentials(credentials),
            events: validateEvents(input.provider, input.events),
            createdById: actor.id,
        },
    });
    await audit(prisma, actor.id, "integration.created", "Integration", integration.id, { provider: integration.provider });
    return serializeIntegration(integration);
}

export const getIntegration = async (id: string) => serializeIntegration(await load(id));

export async function updateIntegration(actor: SessionUser, id: string, input: Partial<Omit<IntegrationInput, "provider">>) {
    const current = await load(id);
    const { config, credentials } = validateFields(
        current.provider,
        { ...(current.config as Record<string, any>), ...(input.config ?? {}) },
        input.credentials ?? {},
        decryptJson(current.credentials),
    );
    const updated = await prisma.integration.update({
        where: { id },
        data: {
            name: input.name,
            enabled: input.enabled,
            config,
            credentials: encryptCredentials(credentials),
            events: input.events ? validateEvents(current.provider, input.events) : undefined,
        },
    });
    await audit(prisma, actor.id, "integration.updated", "Integration", updated.id, { enabled: updated.enabled, events: updated.events });
    return serializeIntegration(updated);
}

export async function deleteIntegration(actor: SessionUser, id: string) {
    const current = await load(id);
    await prisma.integration.delete({ where: { id } });
    await audit(prisma, actor.id, "integration.deleted", "Integration", id, { provider: current.provider, name: current.name });
}

export async function testIntegrationById(id: string, recipient?: string | null) {
    const i = await load(id);
    try {
        return await testIntegration(i, recipient);
    } catch (e) {
        return { ok: false, retryable: false, error: e instanceof Error ? e.message : String(e) };
    }
}

export async function listDeliveries(id: string, status?: string | null) {
    await load(id);
    return rootPrisma.delivery.findMany({
        where: { integrationId: id, ...(status ? { status: { in: status.split(",") } } : {}) },
        include: { event: { select: { id: true, type: true, createdAt: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
    });
}

/** Replays a delivery after checking it belongs to one of the caller's integrations. */
export async function retryDeliveryForOrg(deliveryId: string) {
    const delivery = await rootPrisma.delivery.findUnique({ where: { id: deliveryId }, select: { integrationId: true } });
    if (!delivery) throw new HttpError(404, "Delivery not found.");
    await load(delivery.integrationId);
    return runAsSystem(() => retryDelivery(deliveryId));
}

export async function syncIntegrationById(id: string) {
    return runPullSync(await load(id));
}

// ---------- OAuth ----------

export async function startOAuth(id: string, nonce: string) {
    const i = await load(id);
    const oauth = getConnector(i.provider)?.oauth;
    if (!oauth?.available()) throw new HttpError(400, "OAuth is not configured on the server for this provider. Set its client ID and secret.");
    const state = signToken({ integrationId: i.id, nonce }, 600);
    return oauth.authorizeUrl({ redirectUri: OAUTH_REDIRECT(), state, config: i.config as Record<string, any> });
}

/** Returns the query string to append to /integrations after the provider redirects back. */
export async function completeOAuth(actor: SessionUser, params: URLSearchParams, cookieNonce: string | undefined): Promise<string> {
    if (params.get("error")) return `oauth_error=${encodeURIComponent(params.get("error_description") || params.get("error")!)}`;
    const state = verifyToken<{ integrationId: string; nonce: string }>(params.get("state"));
    if (!state || !cookieNonce || state.nonce !== cookieNonce) return "oauth_error=The+sign-in+link+expired.+Try+Connect+again.";

    const integration = await prisma.integration.findUnique({ where: { id: state.integrationId } });
    const oauth = integration && getConnector(integration.provider)?.oauth;
    const code = params.get("code");
    if (!integration || !oauth || !code) return "oauth_error=Unknown+integration";
    try {
        const tokens = await oauth.exchange({ code, redirectUri: OAUTH_REDIRECT(), config: integration.config as Record<string, any> });
        await buildContext(integration).saveCredentials(tokens);
        await audit(prisma, actor.id, "integration.connected", "Integration", integration.id, { provider: integration.provider });
        return `connected=${integration.id}`;
    } catch (e) {
        return `oauth_error=${encodeURIComponent(e instanceof Error ? e.message : "OAuth failed")}`;
    }
}

// ---------- Inbound webhooks ----------

/**
 * Inbound call for one integration: verify → de-duplicate → map to commands → apply through
 * services, all inside the integration's organization.
 */
export async function handleInbound(integrationId: string, req: Request): Promise<unknown> {
    const integration = await runAsSystem(() => rootPrisma.integration.findUnique({ where: { id: integrationId } }));
    const connector = integration && getConnector(integration.provider);
    if (!integration || !integration.enabled || !connector?.receive) throw new HttpError(404, "Not found");

    return runWithTenant(integration.organizationId, async () => {
        const rawBody = await req.text();
        const inbound = { headers: req.headers, rawBody, url: new URL(req.url) };
        const ctx = buildContext(integration);
        if (connector.verify && !(await connector.verify(inbound, ctx))) throw new HttpError(401, "Signature check failed");

        const result = await connector.receive!(inbound, ctx);
        if (result.response) return result.response;

        if (result.deliveryId) {
            try {
                await rootPrisma.inboundEvent.create({ data: { id: `${integration.id}:${result.deliveryId}`.slice(0, 190), provider: integration.provider } });
            } catch (e) {
                if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: true, duplicate: true };
                throw e;
            }
        }
        const results = await executeCommands(result.commands, integration);
        const custom = result.onResult ? await result.onResult(results) : undefined;
        return custom ?? { ok: results.every(r => r.ok), results };
    });
}
