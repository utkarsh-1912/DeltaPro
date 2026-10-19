import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError, route } from "@/lib/api";
import { signToken } from "@/integrations/crypto";
import { appBaseUrl } from "@/integrations/http";
import { getConnector } from "@/integrations/registry";

export const dynamic = "force-dynamic";

const OAUTH_COOKIE = "deltapro_oauth_nonce"; // read back in /api/oauth/callback

/** Starts the provider's OAuth consent screen for this integration. */
export const GET = route<{ id: string }>(async ({ params }) => {
    const i = await prisma.integration.findUnique({ where: { id: params.id } });
    if (!i) throw new HttpError(404, "Integration not found.");
    const oauth = getConnector(i.provider)?.oauth;
    if (!oauth?.available()) throw new HttpError(400, "OAuth is not configured on the server for this provider. Set its client ID and secret.");

    const nonce = randomBytes(16).toString("base64url");
    (await cookies()).set(OAUTH_COOKIE, nonce, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
    const state = signToken({ integrationId: i.id, nonce }, 600);
    const url = oauth.authorizeUrl({ redirectUri: `${appBaseUrl()}/api/oauth/callback`, state, config: i.config as Record<string, any> });
    return Response.redirect(url, 302);
}, { roles: [Role.ADMIN] });
