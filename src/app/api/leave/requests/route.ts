import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@prisma/client";

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");

        let where: any = {};
        if (session.user.role === Role.ADMIN || session.user.role === Role.HR) {
            if (userId) where.userId = userId;
        } else if (session.user.role === Role.PM) {
            // PM can see their own and their subordinates
            where = {
                OR: [
                    { userId: session.user.id },
                    { user: { managerId: session.user.id } }
                ]
            };
        } else {
            where.userId = session.user.id;
        }

        const requests = await prisma.leaveRequest.findMany({
            where,
            include: {
                user: { select: { name: true, image: true, role: true } },
                approver: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json(requests);
    } catch (error) {
        console.error("Leave Request GET error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { type, startDate, endDate, reason, isHalfDay, duration } = body;

        // 1. Check Balance
        const balance = await prisma.leaveBalance.findUnique({
            where: {
                userId_type_year: {
                    userId: session.user.id,
                    type: type,
                    year: new Date().getFullYear()
                }
            }
        });

        if (!balance || balance.available < duration) {
            return NextResponse.json({ error: "Insufficient leave balance for this type." }, { status: 400 });
        }

        // 2. Create Request
        const request = await prisma.leaveRequest.create({
            data: {
                userId: session.user.id,
                type,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                reason,
                isHalfDay: isHalfDay || false,
                duration: duration || 1.0,
                status: "PENDING"
            }
        });

        return NextResponse.json(request, { status: 201 });
    } catch (error) {
        console.error("Leave Request POST error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
