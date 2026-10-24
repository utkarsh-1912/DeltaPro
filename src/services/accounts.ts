import { createHash, randomBytes } from "node:crypto";
import { rootPrisma } from "@/lib/prisma";
import { HttpError } from "@/lib/errors";
import { hashPassword, isBootstrapAdmin } from "@/lib/password";
import { runAsSystem, runWithTenant } from "@/server/context";
import { sendDirectEmail } from "@/integrations/connectors/email";
import { appBaseUrl } from "@/integrations/http";
import { createEmployee } from "./users";
import { resolveOrganizationForSignup } from "./organizations";
import { Role } from "@prisma/client";

const TOKEN_TTL_MS = 60 * 60 * 1000;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Emails are unique across all organizations: one login belongs to one company. */
export async function emailExists(email: string) {
    return !!(await rootPrisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } }));
}

export async function signUp(
    input: { name: string; email: string; password: string; company?: string },
    run: typeof runWithTenant = runWithTenant,
) {
    const { organization, role, created } = await resolveOrganizationForSignup(input.email, input.company);
    const user = await run(organization.id, () =>
        createEmployee(null, {
            email: input.email,
            name: input.name,
            password: input.password,
            role: isBootstrapAdmin(input.email) ? Role.ADMIN : role,
        }),
    );
    return { id: user.id, email: user.email, organization: { id: organization.id, name: organization.name, created } };
}

/** Step 1 of password reset: email a one-hour link through the user's own organization's email integration. */
export async function requestPasswordReset(email: string) {
    const user = await rootPrisma.user.findUnique({ where: { email } });
    if (!user?.isActive) return;
    const token = randomBytes(32).toString("base64url");
    await rootPrisma.verificationToken.deleteMany({ where: { identifier: `reset:${email}` } });
    await rootPrisma.verificationToken.create({ data: { identifier: `reset:${email}`, token: sha(token), expires: new Date(Date.now() + TOKEN_TTL_MS) } });
    const link = `${appBaseUrl()}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    await runWithTenant(user.organizationId, () =>
        sendDirectEmail(email, "Reset your DeltaPro password", "Use the link below to choose a new password. It expires in one hour. If you didn't ask for this, ignore this email.", link),
    );
}

/** Step 2: set the new password with the emailed token and end existing sessions. */
export async function completePasswordReset(token: string, password: string) {
    return runAsSystem(async () => {
        const row = await rootPrisma.verificationToken.findUnique({ where: { token: sha(token) } });
        if (!row || !row.identifier.startsWith("reset:") || row.expires < new Date()) {
            throw new HttpError(400, "This reset link is invalid or has expired. Request a new one.");
        }
        const email = row.identifier.slice("reset:".length);
        await rootPrisma.$transaction([
            rootPrisma.user.update({ where: { email }, data: { passwordHash: await hashPassword(password) } }),
            rootPrisma.verificationToken.delete({ where: { token: row.token } }),
            rootPrisma.session.deleteMany({ where: { user: { email } } }),
        ]);
    });
}
