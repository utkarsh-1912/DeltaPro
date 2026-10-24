import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { route } from "@/lib/api";
import { completeOAuth } from "@/integrations/manage";
import { appBaseUrl } from "@/integrations/http";

export const dynamic = "force-dynamic";

/** Shared OAuth redirect URI for every provider: {APP_URL}/api/oauth/callback */
export const GET = route(async ({ req, user }) => {
    const jar = await cookies();
    const nonce = jar.get("deltapro_oauth_nonce")?.value;
    jar.delete("deltapro_oauth_nonce");
    const query = await completeOAuth(user, new URL(req.url).searchParams, nonce);
    return Response.redirect(`${appBaseUrl()}/integrations?${query}`, 302);
}, { roles: [Role.ADMIN] });
