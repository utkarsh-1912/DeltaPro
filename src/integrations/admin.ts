import type { Integration } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/api";
import { buildContext } from "./context";
import { decryptJson, encryptJson, maskSecret } from "./crypto";
import { EVENT_TYPES, type DomainEvent } from "./events";
import { appBaseUrl } from "./http";
import { executeCommands } from "./commands";
import { getConnector } from "./registry";
import type { DeliveryResult } from "./types";

/** Integration as the admin UI sees it: secrets masked, webhook URL and delivery health included. */
export async function serializeIntegration(i: Integration) {
    const connector = getConnector(i.provider);
    const creds = (() => {
        try { return decryptJson(i.credentials); } catch { return {}; }
    })();
    const credentialsSet: Record<string, string> = {};
    for (const f of connector?.fields.filter(f => f.scope === "credentials") ?? []) {
        if (creds[f.key]) credentialsSet[f.key] = f.type === "secret" ? maskSecret(creds[f.key]) : String(creds[f.key]);
    }
    if (creds.refresh_token || creds.botToken) credentialsSet.__oauth = "connected";

    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [grouped, lastFailure] = await Promise.all([
        prisma.delivery.groupBy({ by: ["status"], where: { integrationId: i.id, OR: [{ status: { in: ["PENDING", "FAILED", "DEAD", "RUNNING"] } }, { updatedAt: { gte: since } }] }, _count: true }),
        prisma.delivery.findFirst({ where: { integrationId: i.id, status: { in: ["FAILED", "DEAD"] } }, orderBy: { updatedAt: "desc" }, select: { lastError: true, updatedAt: true } }),
    ]);
    const stats = Object.fromEntries(grouped.map(g => [g.status, g._count]));

    return {
        id: i.id,
        provider: i.provider,
        name: i.name,
        enabled: i.enabled,
        config: i.config,
        events: i.events,
        credentialsSet,
        lastSyncAt: i.lastSyncAt,
        createdAt: i.createdAt,
        webhookUrl: connector?.inbound ? `${appBaseUrl()}/api/hooks/${i.id}` : null,
        scimBaseUrl: i.provider === "scim" ? `${appBaseUrl()}/api/scim/v2` : null,
        stats,
        lastError: lastFailure?.lastError ?? null,
    };
}

/** Validate config and credentials against the connector's field list. */
export function validateFields(provider: string, config: Record<string, any>, credentials: Record<string, any>, existingCreds: Record<string, any> = {}) {
    const connector = getConnector(provider);
    if (!connector) throw new HttpError(400, `Unknown provider ${provider}`);
    const cleanConfig: Record<string, any> = {};
    const mergedCreds: Record<string, any> = { ...existingCreds };
    for (const f of connector.fields) {
        if (f.scope === "config") {
            const v = config[f.key] ?? f.default;
            if (v !== undefined && v !== "") cleanConfig[f.key] = f.type === "boolean" ? v === true || v === "true" : f.type === "number" ? Number(v) : v;
            if (f.required && (cleanConfig[f.key] === undefined || cleanConfig[f.key] === "")) throw new HttpError(400, `${f.label} is required.`);
            if (f.type === "url" && cleanConfig[f.key] && !/^https?:\/\//.test(cleanConfig[f.key])) throw new HttpError(400, `${f.label} must be an http(s) URL.`);
        } else {
            const v = credentials[f.key];
            if (v === null) delete mergedCreds[f.key];
            else if (typeof v === "string" && v.trim() !== "") mergedCreds[f.key] = v.trim();
            const oauthCovers = connector.oauth?.available() && (mergedCreds.refresh_token || mergedCreds.botToken);
            if (f.required && !mergedCreds[f.key] && !oauthCovers) throw new HttpError(400, `${f.label} is required.`);
        }
    }
    return { config: cleanConfig, credentials: mergedCreds };
}

export function validateEvents(provider: string, events: string[] | undefined): string[] {
    const connector = getConnector(provider)!;
    const list = events ?? connector.defaultEvents;
    const allowed = connector.supportedEvents === "*" ? [...EVENT_TYPES, "*"] : connector.supportedEvents;
    const bad = list.filter(e => !(allowed as string[]).includes(e));
    if (bad.length) throw new HttpError(400, `${connector.name} cannot subscribe to: ${bad.join(", ")}`);
    return list;
}

export function encryptCredentials(creds: Record<string, any>): string | null {
    return Object.keys(creds).length ? encryptJson(creds) : null;
}

/** "Test" button: provider health check, otherwise send an integration.test event straight through the handler. */
export async function testIntegration(i: Integration, recipient?: string | null): Promise<DeliveryResult> {
    const connector = getConnector(i.provider);
    if (!connector) return { ok: false, retryable: false, error: "Unknown provider" };
    const ctx = buildContext(i);
    if (connector.healthCheck) return connector.healthCheck(ctx);
    if (!connector.handle) return { ok: true, note: "Inbound-only connector. Send a request to its webhook URL to test." };
    const event: DomainEvent = {
        id: `test_${Date.now()}`,
        type: "integration.test",
        version: 1,
        occurredAt: new Date().toISOString(),
        actor: null,
        subject: { type: "Integration", id: i.id },
        data: { message: `Test from DeltaPro: ${i.name} is connected.`, recipient },
    };
    return connector.handle(event, ctx);
}

/** Pull-based connectors (BambooHR): read the source and apply the commands it yields. */
export async function runPullSync(i: Integration) {
    const connector = getConnector(i.provider);
    if (!connector?.pullSync) throw new HttpError(400, `${connector?.name ?? i.provider} has no scheduled sync.`);
    const { commands, note } = await connector.pullSync(buildContext(i));
    const results = await executeCommands(commands, i);
    await prisma.integration.update({ where: { id: i.id }, data: { lastSyncAt: new Date() } });
    return { note, total: results.length, failed: results.filter(r => !r.ok).length, results: results.slice(0, 50) };
}
