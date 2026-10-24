import type { Integration } from "@prisma/client";
import { rootPrisma as prisma } from "@/lib/prisma";
import { decryptJson, encryptJson } from "./crypto";
import { appBaseUrl } from "./http";
import type { ConnectorContext } from "./types";

export function buildContext(integration: Integration): ConnectorContext {
    let credentials = decryptJson(integration.credentials);
    const id = integration.id;
    return {
        integration: {
            id,
            name: integration.name,
            provider: integration.provider,
            config: (integration.config ?? {}) as Record<string, any>,
            lastSyncAt: integration.lastSyncAt,
        },
        get credentials() {
            return credentials;
        },
        async saveCredentials(patch) {
            credentials = { ...credentials, ...patch };
            await prisma.integration.update({ where: { id }, data: { credentials: encryptJson(credentials) } });
        },
        links: {
            async get(localType, localId) {
                const link = await prisma.externalLink.findUnique({
                    where: { integrationId_localType_localId: { integrationId: id, localType, localId } },
                });
                return link?.externalId ?? null;
            },
            async set(localType, localId, externalId) {
                await prisma.externalLink.upsert({
                    where: { integrationId_localType_localId: { integrationId: id, localType, localId } },
                    create: { integrationId: id, localType, localId, externalId },
                    update: { externalId },
                });
            },
            async remove(localType, localId) {
                await prisma.externalLink.deleteMany({ where: { integrationId: id, localType, localId } });
            },
            async findLocal(localType, externalId) {
                const link = await prisma.externalLink.findFirst({ where: { integrationId: id, localType, externalId } });
                return link?.localId ?? null;
            },
            async listByPrefix(localType, prefix) {
                const rows = await prisma.externalLink.findMany({
                    where: { integrationId: id, localType, localId: { startsWith: prefix } },
                    select: { localId: true, externalId: true },
                });
                return rows;
            },
        },
        baseUrl: appBaseUrl(),
    };
}
