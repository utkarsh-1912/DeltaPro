import { publicRoute } from "@/lib/api";
import { handleInbound } from "@/integrations/manage";

export const dynamic = "force-dynamic";

/** Inbound endpoint for one integration (Slack interactivity, Jira/GitHub/HRIS webhooks, device punches). */
export const POST = publicRoute<{ id: string }>(async ({ req, params }) => handleInbound(params.id, req));
