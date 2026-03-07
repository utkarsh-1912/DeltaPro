import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"
import { authConfig } from "./auth.config"

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma),
    providers: [
        CredentialsProvider({
            name: "Demo Account",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email) return null;

                // For demonstration, simply look up the user by email or create them
                let user = await prisma.user.findUnique({
                    where: { email: credentials.email as string }
                });

                if (!user) {
                    user = await prisma.user.create({
                        data: {
                            email: credentials.email as string,
                            role: Role.USER,
                            name: (credentials.email as string).split('@')[0]
                        }
                    });
                }

                return user;
            }
        })
    ]
})

