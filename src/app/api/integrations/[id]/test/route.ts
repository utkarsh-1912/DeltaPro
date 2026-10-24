import { Role } from "@prisma/client";
import { route } from "@/lib/api";
import { testIntegrationById } from "@/integrations/manage";

export const dynamic = "force-dynamic";

/** Sends a test message (to the admin, for email and Slack DMs) or runs the provider's credential check. */
export const POST = route<{ id: string }>(async ({ user, params }) => testIntegrationById(params.id, user.email), { roles: [Role.ADMIN] });
