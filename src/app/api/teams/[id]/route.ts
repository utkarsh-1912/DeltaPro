import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const teams = await prisma.team.findMany({
            include: { members: true, shifts: true },
            orderBy: { name: "asc" },
        });
        return NextResponse.json(teams);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user || !["ADMIN", "HR", "PM"].includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
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
        return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
    }
}
