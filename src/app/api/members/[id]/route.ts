export const dynamic = 'force-dynamic';
import { requireRole, handleAuthError } from "@/lib/auth-utils";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const members = await prisma.teamMember.findMany({
            orderBy: { name: "asc" },
        });
        return NextResponse.json(members);
    } catch (error) {
        if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return handleAuthError(error);
        return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await requireRole([Role.ADMIN, Role.HR, Role.PM]);
        const body = await req.json();
        const member = await prisma.teamMember.create({
            data: {
                id: body.id || new Date().getTime().toString(),
                name: body.name,
                email: body.email,
                teamId: body.teamId || null,
                fixedShiftId: body.fixedShiftId || null,
                lastShiftId: body.lastShiftId || null,
            },
        });
        return NextResponse.json(member, { status: 201 });
    } catch (error) {
        if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return handleAuthError(error);
        return NextResponse.json({ error: "Failed to create member" }, { status: 500 });
    }
}
