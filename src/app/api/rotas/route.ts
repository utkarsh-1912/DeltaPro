export const dynamic = 'force-dynamic';
import { requireRole, handleAuthError } from "@/lib/auth-utils";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const rotas = await prisma.rotaGeneration.findMany({
            include: { weekendRotas: true },
            orderBy: { startDate: "desc" },
        });
        return NextResponse.json(rotas);
    } catch (error) {
        if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return handleAuthError(error);
        return NextResponse.json({ error: "Failed to fetch rotas" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await requireRole([Role.ADMIN, Role.HR, Role.PM]);
        const body = await req.json();
        const rota = await prisma.rotaGeneration.create({
            data: {
                id: body.id || new Date().getTime().toString(),
                startDate: body.startDate,
                endDate: body.endDate,
                teamId: body.teamId,
                assignments: body.assignments || {},
                teamMembersAtGeneration: body.teamMembersAtGeneration || null,
                manualOverrides: body.manualOverrides || [],
                manualSwaps: body.manualSwaps || [],
                manualWeekendSwaps: body.manualWeekendSwaps || [],
                comments: body.comments || {},
                adhoc: body.adhoc || null,
            },
        });
        return NextResponse.json(rota, { status: 201 });
    } catch (error) {
        if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return handleAuthError(error);
        return NextResponse.json({ error: "Failed to create rota" }, { status: 500 });
    }
}
