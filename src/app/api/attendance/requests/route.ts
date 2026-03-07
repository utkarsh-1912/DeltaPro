import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";

export async function GET(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const role = session.user.role;

    try {
        let where: any = {};

        // If regular user, only see their own requests
        if (role === Role.USER || role === Role.DEV) {
            where.userId = session.user.id;
        } else if (role === Role.PM) {
            // Managers see their own and their subordinates' requests
            where = {
                OR: [
                    { userId: session.user.id },
                    { user: { managerId: session.user.id } }
                ]
            };
        }
        // HR and ADMIN see everything by default, unless userId is specified

        if (userId) {
            where.userId = userId;
        }

        const requests = await prisma.attendanceRequest.findMany({
            where,
            include: {
                user: { select: { name: true, image: true, role: true } },
                approver: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json(requests);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch attendance requests" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const request = await prisma.attendanceRequest.create({
            data: {
                userId: session.user.id,
                type: body.type, // CLOCK_IN, CLOCK_OUT, FULL_DAY
                date: new Date(body.date),
                reason: body.reason,
            },
        });
        return NextResponse.json(request, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create attendance request" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = session.user.role;
    if (role === Role.USER || role === Role.DEV) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { id, status } = body;

        const updatedRequest = await prisma.attendanceRequest.update({
            where: { id },
            data: {
                status,
                approverId: session.user.id
            }
        });

        // If approved, create the attendance log automatically
        if (status === "APPROVED") {
            const reqData = await prisma.attendanceRequest.findUnique({ where: { id } });
            if (reqData) {
                await prisma.attendanceLog.create({
                    data: {
                        userId: reqData.userId,
                        loginTime: reqData.date, // Simplification: set loginTime to the requested date
                        logoutTime: reqData.type === "FULL_DAY" ? new Date(new Date(reqData.date).setHours(new Date(reqData.date).getHours() + 9)) : null,
                        loginLocation: "Regularization",
                        status: "LOGGED_OUT"
                    }
                });
            }
        }

        return NextResponse.json(updatedRequest);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update attendance request" }, { status: 500 });
    }
}
