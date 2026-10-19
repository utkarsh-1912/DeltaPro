import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/activity";
import { route } from "@/lib/api";
import { buildContext } from "@/integrations/context";
import { safeEqual, verifyToken } from "@/integrations/crypto";
import { appBaseUrl } from "@/integrations/http";
import { getConnector } from "@/integrations/registry";

export const dynamic = "force-dynamic";

const back = (query: string) => Response.redirect(`${appBaseUrl()}/integrations?${query}`, 302);

/** Shared OAuth redirect URI for every provider: {APP_URL}/api/oauth/callback */
export const GET = route(async ({ req, user }) => {
    const url = new URL(req.url);
    if (url.searchParams.get("error")) return back(`oauth_error=${encodeURIComponent(url.searchParams.get("error_description") || url.searchParams.get("error")!)}`);

    const state = verifyToken<{ integrationId: string; nonce: string }>(url.searchParams.get("state"));
    const jar = await cookies();
    const nonce = jar.get("deltapro_oauth_nonce")?.value;
    jar.delete("deltapro_oauth_nonce");
    if (!state || !safeEqual(state.nonce, nonce)) return back("oauth_error=The+sign-in+link+expired.+Try+Connect+again.");

    const integration = await prisma.integration.findUnique({ where: { id: state.integrationId } });
    const oauth = integration && getConnector(integration.provider)?.oauth;
    const code = url.searchParams.get("code");
    if (!integration || !oauth || !code) return back("oauth_error=Unknown+integration");

    try {
        const tokens = await oauth.exchange({ code, redirectUri: `${appBaseUrl()}/api/oauth/callback`, config: integration.config as Record<string, any> });
        await buildContext(integration).saveCredentials(tokens);
        await audit(prisma, user.id, "integration.connected", "Integration", integration.id, { provider: integration.provider });
        return back(`connected=${integration.id}`);
    } catch (e) {
        return back(`oauth_error=${encodeURIComponent(e instanceof Error ? e.message : "OAuth failed")}`);
    }
}, { roles: [Role.ADMIN] });
