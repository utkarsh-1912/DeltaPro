import { auth } from "@/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const leaves = await prisma.leave.findMany({
            orderBy: { startDate: "asc" },
        });
        return NextResponse.json(leaves);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch leaves" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user || !["ADMIN", "HR", "PM"].includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
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
        return NextResponse.json({ error: "Failed to create leave" }, { status: 500 });
    }
}
