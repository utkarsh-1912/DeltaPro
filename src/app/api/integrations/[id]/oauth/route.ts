import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { route } from "@/lib/api";
import { startOAuth } from "@/integrations/manage";

export const dynamic = "force-dynamic";

/** Starts the provider's OAuth consent screen for this integration. The nonce cookie is checked in /api/oauth/callback. */
export const GET = route<{ id: string }>(async ({ params }) => {
    const nonce = randomBytes(16).toString("base64url");
    const url = await startOAuth(params.id, nonce);
    (await cookies()).set("deltapro_oauth_nonce", nonce, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
    return Response.redirect(url, 302);
}, { roles: [Role.ADMIN] });
