export const dynamic = 'force-dynamic';
import { requireRole, handleAuthError } from "@/lib/auth-utils";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const SHIFT_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
];

export async function GET() {
    try {
        const shifts = await prisma.shift.findMany({
            orderBy: { sequence: "asc" },
        });
        return NextResponse.json(shifts);
    } catch (error) {
        if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return handleAuthError(error);
        return NextResponse.json({ error: "Failed to fetch shifts" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await requireRole([Role.ADMIN, Role.HR, Role.PM]);
        const body = await req.json();
        const existingCount = await prisma.shift.count({ where: { teamId: body.teamId } });
        const shift = await prisma.shift.create({
            data: {
                id: body.id || new Date().getTime().toString(),
                name: body.name,
                startTime: body.startTime,
                endTime: body.endTime,
                color: SHIFT_COLORS[existingCount % SHIFT_COLORS.length],
                sequence: body.sequence,
                isExtreme: body.isExtreme,
                minTeam: body.minTeam,
                maxTeam: body.maxTeam,
                teamId: body.teamId,
            },
        });
        return NextResponse.json(shift, { status: 201 });
    } catch (error) {
        if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return handleAuthError(error);
        return NextResponse.json({ error: "Failed to create shift" }, { status: 500 });
    }
}
