import { HttpError, publicRoute } from "@/lib/api";
import { safeEqual } from "@/integrations/crypto";
import { runJob } from "@/services/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Called by Cloud Scheduler (or any cron) with `Authorization: Bearer $CRON_SECRET`.
 * Jobs: dispatch, auto-logout, sync, cleanup; /api/cron/all runs auto-logout, dispatch and sync.
 */
async function handle(req: Request, job: string) {
    const secret = process.env.CRON_SECRET;
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!secret || !safeEqual(token, secret)) throw new HttpError(401, "Unauthorized");
    return runJob(job);
}

export const GET = publicRoute<{ job: string }>(({ req, params }) => handle(req, params.job));
export const POST = GET;
