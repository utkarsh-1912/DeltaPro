import NextAuth from "next-auth"
import type { Provider } from "next-auth/providers"
import CredentialsProvider from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { Role } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { authConfig } from "./auth.config"
import { verifyPassword, isAllowedDomain, isBootstrapAdmin } from "@/lib/password"
import { linkTeamMembersToUser } from "@/lib/people"

const credentialsSchema = z.object({
    email: z.string().email().transform(e => e.toLowerCase().trim()),
    password: z.string().min(1),
});

// How often a signed-in session re-reads role / active flag from the database.
const ROLE_REFRESH_MS = 5 * 60 * 1000;

const providers: Provider[] = [
    CredentialsProvider({
        name: "Email and password",
        credentials: {
            email: { label: "Email", type: "email" },
            password: { label: "Password", type: "password" }
        },
        async authorize(raw) {
            const parsed = credentialsSchema.safeParse(raw);
            if (!parsed.success) return null;
            const { email, password } = parsed.data;

            const user = await prisma.user.findUnique({ where: { email } });
            if (!user || !user.isActive || !user.passwordHash) return null;
            if (!(await verifyPassword(password, user.passwordHash))) return null;

            return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role } as any;
        }
    }),
];

// SSO providers are enabled by environment variables (Auth.js reads AUTH_GOOGLE_ID/SECRET
// and AUTH_MICROSOFT_ENTRA_ID_ID/SECRET/ISSUER automatically).
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(Google({ allowDangerousEmailAccountLinking: true }));
}
if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
    providers.push(MicrosoftEntraID({
        issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
        allowDangerousEmailAccountLinking: true,
    }));
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma),
    providers,
    callbacks: {
        ...authConfig.callbacks,
        async signIn({ user, account }) {
            if (account?.provider === "credentials") return true;
            if (!isAllowedDomain(user.email)) return false;
            if (user.email) {
                const existing = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() }, select: { isActive: true } });
                if (existing && !existing.isActive) return false;
            }
            return true;
        },
        async jwt(params) {
            const token = await authConfig.callbacks.jwt(params);
            const refreshedAt = (token as any).refreshedAt as number | undefined;
            if (params.user || params.trigger === "update" || !refreshedAt || Date.now() - refreshedAt > ROLE_REFRESH_MS) {
                if (!token.id) return null;
                let dbUser = await prisma.user.findUnique({ where: { id: token.id as string }, select: { role: true, isActive: true, email: true } });
                if (!dbUser || !dbUser.isActive) return null;
                // Existing accounts listed in AUTH_ADMIN_EMAILS are promoted on their next sign-in.
                if (dbUser.role !== Role.ADMIN && isBootstrapAdmin(dbUser.email)) {
                    dbUser = await prisma.user.update({ where: { id: token.id as string }, data: { role: Role.ADMIN }, select: { role: true, isActive: true, email: true } });
                }
                token.role = dbUser.role;
                (token as any).refreshedAt = Date.now();
            }
            return token;
        },
    },
    events: {
        // Fires for users created by an SSO provider through the Prisma adapter.
        async createUser({ user }) {
            if (!user.id) return;
            if (isBootstrapAdmin(user.email)) {
                await prisma.user.update({ where: { id: user.id }, data: { role: Role.ADMIN } });
            }
            await linkTeamMembersToUser(user.id, user.email);
        },
    },
})
