import { prisma } from "@/lib/prisma";
import { HttpError, publicRoute } from "@/lib/api";
import { safeEqual } from "@/integrations/crypto";
import { dispatchPending } from "@/integrations/dispatcher";
import { runPullSync } from "@/integrations/admin";
import { getConnector } from "@/integrations/registry";
import { autoLogoutStale } from "@/services/attendance";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PULL_INTERVAL_MS = 6 * 3600 * 1000;

const JOBS: Record<string, () => Promise<unknown>> = {
    /** Every minute: fan out new events and retry due deliveries. */
    dispatch: () => dispatchPending(),
    /** Every 15 minutes: close sessions left open past the limit. */
    "auto-logout": () => autoLogoutStale(),
    /** Hourly: pull-based HRIS syncs that are due (every 6 hours each). */
    sync: async () => {
        const due = await prisma.integration.findMany({ where: { enabled: true } });
        const out: Record<string, unknown> = {};
        for (const i of due) {
            if (!getConnector(i.provider)?.pullSync) continue;
            if (i.lastSyncAt && Date.now() - i.lastSyncAt.getTime() < PULL_INTERVAL_MS) continue;
            try {
                const r = await runPullSync(i);
                out[i.name] = { total: r.total, failed: r.failed };
            } catch (e) {
                out[i.name] = { error: e instanceof Error ? e.message : String(e) };
            }
        }
        return out;
    },
    /** Housekeeping: drop dispatched events and finished deliveries after 30 days. */
    cleanup: async () => {
        const cutoff = new Date(Date.now() - 30 * 86400000);
        const deliveries = await prisma.delivery.deleteMany({ where: { status: "DONE", updatedAt: { lt: cutoff } } });
        const events = await prisma.outboxEvent.deleteMany({ where: { status: "DISPATCHED", createdAt: { lt: cutoff }, deliveries: { none: {} } } });
        const inbound = await prisma.inboundEvent.deleteMany({ where: { receivedAt: { lt: cutoff } } });
        return { deliveries: deliveries.count, events: events.count, inbound: inbound.count };
    },
};

/**
 * Called by Cloud Scheduler (or any cron) with `Authorization: Bearer $CRON_SECRET`.
 * /api/cron/all runs dispatch, auto-logout and sync in one call.
 */
async function handle(req: Request, job: string) {
    const secret = process.env.CRON_SECRET;
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!secret || !safeEqual(token, secret)) throw new HttpError(401, "Unauthorized");

    if (job === "all") {
        const result: Record<string, unknown> = {};
        for (const name of ["auto-logout", "dispatch", "sync"]) result[name] = await JOBS[name]();
        return result;
    }
    const run = JOBS[job];
    if (!run) throw new HttpError(404, `Unknown job. Use one of: all, ${Object.keys(JOBS).join(", ")}`);
    return { [job]: await run() };
}

export const GET = publicRoute<{ job: string }>(({ req, params }) => handle(req, params.job));
export const POST = GET;
