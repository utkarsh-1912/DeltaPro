import { auth } from "@/auth";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

export async function requireAuth() {
    const session = await auth();
    if (!session?.user) {
        throw new Error("Unauthorized");
    }
    return session.user;
}

export async function requireRole(allowedRoles: Role[]) {
    const user = await requireAuth();
    if (!allowedRoles.includes(user.role as Role)) {
        throw new Error("Forbidden");
    }
    return user;
}

export function handleAuthError(error: unknown) {
    if (error instanceof Error) {
        if (error.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (error.message === "Forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
