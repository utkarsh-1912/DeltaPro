import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError, route } from "@/lib/api";
import { testIntegration } from "@/integrations/admin";

export const dynamic = "force-dynamic";

/** Sends a test message (to the admin, for email and Slack DMs) or runs the provider's credential check. */
export const POST = route<{ id: string }>(async ({ user, params }) => {
    const i = await prisma.integration.findUnique({ where: { id: params.id } });
    if (!i) throw new HttpError(404, "Integration not found.");
    try {
        return await testIntegration(i, user.email);
    } catch (e) {
        return { ok: false, retryable: false, error: e instanceof Error ? e.message : String(e) };
    }
}, { roles: [Role.ADMIN] });
