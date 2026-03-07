export const dynamic = 'force-dynamic';
import { requireRole, handleAuthError } from "@/lib/auth-utils";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const leaves = await prisma.leave.findMany({
            orderBy: { startDate: "asc" },
        });
        return NextResponse.json(leaves);
    } catch (error) {
        if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return handleAuthError(error);
        return NextResponse.json({ error: "Failed to fetch leaves" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await requireRole([Role.ADMIN, Role.HR, Role.PM]);
        const body = await req.json();
        const leave = await prisma.leave.create({
            data: {
                id: body.id || new Date().getTime().toString(),
                memberId: body.memberId,
                startDate: body.startDate,
                endDate: body.endDate,
                type: body.type,
            },
        });
        return NextResponse.json(leave, { status: 201 });
    } catch (error) {
        if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return handleAuthError(error);
        return NextResponse.json({ error: "Failed to create leave" }, { status: 500 });
    }
}
