import NextAuth, { type DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            role: string
            organizationId: string | null
            orgName: string | null
            plan: string | null
        } & DefaultSession["user"]
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string
        role: string
        organizationId?: string | null
        orgName?: string | null
        plan?: string | null
    }
}
