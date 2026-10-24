import type { NextAuthConfig } from "next-auth";

// Edge-safe config shared by middleware and the full Auth.js instance in auth.ts.
// Providers that need Prisma or Node crypto are added in auth.ts only.
export const authConfig = {
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    providers: [],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role;
                token.id = user.id as string;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.role = token.role as string;
                session.user.id = token.id as string;
                session.user.organizationId = (token.organizationId as string | null) ?? null;
                session.user.orgName = (token.orgName as string | null) ?? null;
                session.user.plan = (token.plan as string | null) ?? null;
            }
            return session;
        }
    }
} satisfies NextAuthConfig;
