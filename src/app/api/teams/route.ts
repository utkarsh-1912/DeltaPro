export const dynamic = 'force-dynamic';
import { requireRole, handleAuthError } from "@/lib/auth-utils";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const teams = await prisma.team.findMany({
            include: { members: true, shifts: true },
            orderBy: { name: "asc" },
        });
        return NextResponse.json(teams);
    } catch (error) {
        if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return handleAuthError(error);
        return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await requireRole([Role.ADMIN, Role.HR, Role.PM]);
        const body = await req.json();
        const team = await prisma.team.create({
            data: {
                id: body.id || new Date().getTime().toString(),
                name: body.name,
                pmId: body.pmId === "none" ? null : body.pmId,
            },
        });
        return NextResponse.json(team, { status: 201 });
    } catch (error) {
        if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return handleAuthError(error);
        return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
    }
}
