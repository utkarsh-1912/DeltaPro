import { z } from "zod";
import { HttpError, parseBody, publicRoute } from "@/lib/api";
import { PASSWORD_MIN_LENGTH, isAllowedDomain } from "@/lib/password";
import { runWithTenant } from "@/server/context";
import { emailExists, signUp } from "@/services/accounts";

export const dynamic = "force-dynamic";

const schema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().email().transform(e => e.toLowerCase().trim()),
    password: z.string().min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`).max(200),
    company: z.string().trim().max(100).optional(),
});

/**
 * Self-service sign-up. Joins the organization that has claimed the email domain (if it allows
 * domain join), otherwise creates a new organization on the Starter plan with this person as ADMIN.
 * Disable with AUTH_ALLOW_SIGNUP=false; restrict with AUTH_ALLOWED_DOMAINS.
 */
export const POST = publicRoute(async ({ req }) => {
    if (process.env.AUTH_ALLOW_SIGNUP === "false") throw new HttpError(403, "Sign-up is turned off. Ask your administrator for an account.");
    const body = await parseBody(req, schema);
    if (!isAllowedDomain(body.email)) throw new HttpError(403, "Use your company email address to sign up.");
    if (await emailExists(body.email)) throw new HttpError(409, "An account with this email already exists. Sign in instead.");

    const result = await signUp(body, runWithTenant);
    return Response.json(result, { status: 201 });
});
