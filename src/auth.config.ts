import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { Role } from "@prisma/client";

export const authConfig = {
    session: { strategy: "jwt" },
    providers: [
        CredentialsProvider({
            name: "Demo Account",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                // This will be overridden in auth.ts where Prisma is available
                return null;
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role;
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.role = token.role as Role;
                session.user.id = token.id as string;
            }
            return session;
        }
    }
} satisfies NextAuthConfig;
