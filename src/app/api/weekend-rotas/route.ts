export const dynamic = 'force-dynamic';
import { requireRole, handleAuthError } from "@/lib/auth-utils";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const rotas = await prisma.weekendRota.findMany({
            orderBy: { date: "asc" },
        });
        return NextResponse.json(rotas);
    } catch (error) {
        if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return handleAuthError(error);
        return NextResponse.json({ error: "Failed to fetch weekend rotas" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await requireRole([Role.ADMIN, Role.HR, Role.PM]);
        const body = await req.json();
        // body.rotas is an array of weekend rota objects
        if (Array.isArray(body.rotas)) {
            const created = await prisma.weekendRota.createMany({
                data: body.rotas.map((r: any) => ({
                    date: r.date,
                    memberId: r.memberId,
                    generationId: r.generationId,
                })),
            });
            return NextResponse.json(created, { status: 201 });
        }
        const rota = await prisma.weekendRota.create({
            data: {
                date: body.date,
                memberId: body.memberId,
                generationId: body.generationId,
            },
        });
        return NextResponse.json(rota, { status: 201 });
    } catch (error) {
        if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return handleAuthError(error);
        return NextResponse.json({ error: "Failed to create weekend rota" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        await requireRole([Role.ADMIN, Role.HR, Role.PM]);
        const { searchParams } = new URL(req.url);
        const generationId = searchParams.get("generationId");
        if (!generationId) {
            return NextResponse.json({ error: "generationId is required" }, { status: 400 });
        }
        await prisma.weekendRota.deleteMany({ where: { generationId } });
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return handleAuthError(error);
        return NextResponse.json({ error: "Failed to delete weekend rotas" }, { status: 500 });
    }
}
