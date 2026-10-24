import { rootPrisma } from "@/lib/prisma";
import { HttpError } from "@/lib/errors";
import { runAsSystem, runWithTenant } from "@/server/context";
import { connectorFeature, hasFeature } from "@/server/plans";
import { dispatchPending } from "@/integrations/dispatcher";
import { runPullSync } from "@/integrations/admin";
import { getConnector } from "@/integrations/registry";
import { autoLogoutStale } from "./attendance";

const PULL_INTERVAL_MS = 6 * 3600 * 1000;

/** Runs a function once per active organization, each inside its own tenant context. */
async function forEachOrganization<T>(fn: (orgId: string) => Promise<T>) {
    const orgs = await runAsSystem(() => rootPrisma.organization.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true } }));
    const out: Record<string, T | { error: string }> = {};
    for (const org of orgs) {
        try {
            out[org.name] = await runWithTenant(org.id, () => fn(org.id));
        } catch (e) {
            out[org.name] = { error: e instanceof Error ? e.message : String(e) };
        }
    }
    return out;
}

export const JOBS: Record<string, () => Promise<unknown>> = {
    /** Every minute: fan out new events and retry due deliveries. */
    dispatch: () => dispatchPending(),
    /** Every 15 minutes: close sessions left open past each organization's limit. */
    "auto-logout": () => forEachOrganization(() => autoLogoutStale()),
    /** Hourly: pull-based HRIS syncs that are due (every 6 hours each), for plans that include them. */
    sync: async () => {
        const integrations = await runAsSystem(() => rootPrisma.integration.findMany({ where: { enabled: true } }));
        const plans = new Map((await rootPrisma.organization.findMany({ select: { id: true, plan: true } })).map(o => [o.id, o.plan]));
        const out: Record<string, unknown> = {};
        for (const i of integrations) {
            if (!getConnector(i.provider)?.pullSync) continue;
            const feature = connectorFeature(i.provider);
            if (feature && !hasFeature(i.organizationId ? plans.get(i.organizationId) : null, feature)) continue;
            if (i.lastSyncAt && Date.now() - i.lastSyncAt.getTime() < PULL_INTERVAL_MS) continue;
            try {
                const r = await runWithTenant(i.organizationId, () => runPullSync(i));
                out[i.name] = { total: r.total, failed: r.failed };
            } catch (e) {
                out[i.name] = { error: e instanceof Error ? e.message : String(e) };
            }
        }
        return out;
    },
    /** Daily housekeeping: drop dispatched events and finished deliveries after 30 days. */
    cleanup: () =>
        runAsSystem(async () => {
            const cutoff = new Date(Date.now() - 30 * 86400000);
            const deliveries = await rootPrisma.delivery.deleteMany({ where: { status: "DONE", updatedAt: { lt: cutoff } } });
            const events = await rootPrisma.outboxEvent.deleteMany({ where: { status: "DISPATCHED", createdAt: { lt: cutoff }, deliveries: { none: {} } } });
            const inbound = await rootPrisma.inboundEvent.deleteMany({ where: { receivedAt: { lt: cutoff } } });
            return { deliveries: deliveries.count, events: events.count, inbound: inbound.count };
        }),
};

export async function runJob(name: string) {
    if (name === "all") {
        const result: Record<string, unknown> = {};
        for (const job of ["auto-logout", "dispatch", "sync"]) result[job] = await JOBS[job]();
        return result;
    }
    const run = JOBS[name];
    if (!run) throw new HttpError(404, `Unknown job. Use one of: all, ${Object.keys(JOBS).join(", ")}`);
    return { [name]: await run() };
}
