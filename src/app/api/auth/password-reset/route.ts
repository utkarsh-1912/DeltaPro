import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, parseBody, publicRoute } from "@/lib/api";
import { PASSWORD_MIN_LENGTH, hashPassword } from "@/lib/password";
import { sendDirectEmail } from "@/integrations/connectors/email";
import { appBaseUrl } from "@/integrations/http";

export const dynamic = "force-dynamic";

const TOKEN_TTL_MS = 60 * 60 * 1000;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const requestSchema = z.object({ email: z.string().email().transform(e => e.toLowerCase().trim()) });
const confirmSchema = z.object({ token: z.string().min(20), password: z.string().min(PASSWORD_MIN_LENGTH).max(200) });

/** Step 1: email a one-hour reset link. Always answers 200 so emails can't be enumerated. */
export const POST = publicRoute(async ({ req }) => {
    const { email } = await parseBody(req, requestSchema);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.isActive) {
        const token = randomBytes(32).toString("base64url");
        await prisma.verificationToken.deleteMany({ where: { identifier: `reset:${email}` } });
        await prisma.verificationToken.create({ data: { identifier: `reset:${email}`, token: sha(token), expires: new Date(Date.now() + TOKEN_TTL_MS) } });
        const link = `${appBaseUrl()}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
        await sendDirectEmail(email, "Reset your DeltaPro password", "Use the link below to choose a new password. It expires in one hour. If you didn't ask for this, ignore this email.", link);
    }
    return { ok: true };
});

/** Step 2: set the new password with the emailed token. */
export const PUT = publicRoute(async ({ req }) => {
    const { token, password } = await parseBody(req, confirmSchema);
    const row = await prisma.verificationToken.findUnique({ where: { token: sha(token) } });
    if (!row || !row.identifier.startsWith("reset:") || row.expires < new Date()) {
        throw new HttpError(400, "This reset link is invalid or has expired. Request a new one.");
    }
    const email = row.identifier.slice("reset:".length);
    await prisma.$transaction([
        prisma.user.update({ where: { email }, data: { passwordHash: await hashPassword(password) } }),
        prisma.verificationToken.delete({ where: { token: row.token } }),
        prisma.session.deleteMany({ where: { user: { email } } }),
    ]);
    return { ok: true };
});
