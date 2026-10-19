import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, parseBody, publicRoute } from "@/lib/api";
import { PASSWORD_MIN_LENGTH, isAllowedDomain } from "@/lib/password";
import { createEmployee } from "@/services/users";

export const dynamic = "force-dynamic";

const schema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().email().transform(e => e.toLowerCase().trim()),
    password: z.string().min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`).max(200),
});

/** Self-service sign-up. Disable with AUTH_ALLOW_SIGNUP=false; restrict with AUTH_ALLOWED_DOMAINS. */
export const POST = publicRoute(async ({ req }) => {
    if (process.env.AUTH_ALLOW_SIGNUP === "false") throw new HttpError(403, "Sign-up is turned off. Ask your administrator for an account.");
    const body = await parseBody(req, schema);
    if (!isAllowedDomain(body.email)) throw new HttpError(403, "Use your company email address to sign up.");

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new HttpError(409, "An account with this email already exists. Sign in instead.");

    const user = await createEmployee(null, { email: body.email, name: body.name, password: body.password });
    return Response.json({ id: user.id, email: user.email }, { status: 201 });
});
