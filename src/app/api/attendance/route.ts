import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { startOfWeek, endOfWeek, parseISO, differenceInMinutes } from "date-fns";
import { Role } from "@prisma/client";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const role = session.user.role as Role;

    try {
        let where: any = {};

        // Role-based filtering
        if (role === Role.USER || role === Role.DEV) {
            where.userId = session.user.id;
        } else if (role === Role.PM) {
            // Managers see their own and their subordinates logs
            where = {
                OR: [
                    { userId: session.user.id },
                    { user: { managerId: session.user.id } }
                ]
            };
        }
        // HR and ADMIN see everything

        if (userId && (role === Role.ADMIN || role === Role.HR)) {
            where.userId = userId;
        }

        const logs = await prisma.attendanceLog.findMany({
            where,
            include: {
                user: { select: { name: true, image: true, role: true } }
            },
            orderBy: { loginTime: "desc" },
        });

        // Calculate Weekly Total (Minutes) - only for personal view or if specific userId is requested
        let metrics = null;
        if (where.userId) {
            let totalMinutes = 0;
            logs.forEach(log => {
                if (log.loginTime && log.logoutTime) {
                    totalMinutes += differenceInMinutes(new Date(log.logoutTime), new Date(log.loginTime));
                }
            });

            const weeklyTotalHours = Math.floor(totalMinutes / 60);
            const weeklyTotalMinutes = totalMinutes % 60;
            const weeklyTotalFormatted = `${weeklyTotalHours}h ${weeklyTotalMinutes}m`;

            const weeklyTargetMinutes = 2400;
            const targetPercentage = Math.min(Math.round((totalMinutes / weeklyTargetMinutes) * 100), 100);

            const distinctDays = new Set(logs.map(l => new Date(l.loginTime).toDateString())).size;
            const workingDays = 5;
            const attendanceScore = Math.min(Math.round((distinctDays / workingDays) * 100), 100);

            metrics = {
                weeklyTotal: weeklyTotalFormatted,
                targetPercentage,
                attendanceScore: `${attendanceScore}%`,
                totalMinutes
            };
        }

        return NextResponse.json({ logs, metrics });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const log = await prisma.attendanceLog.create({
            data: {
                userId: session.user.id,
                loginTime: body.loginTime ? new Date(body.loginTime) : new Date(),
                logoutTime: body.logoutTime ? new Date(body.logoutTime) : null,
                loginLocation: body.loginLocation || "Remote",
                logoutLocation: body.logoutLocation || null,
                latitude: body.latitude || null,
                longitude: body.longitude || null,
                accuracy: body.accuracy || null,
                status: body.status || "LOGGED_IN",
                isWfh: body.isWfh || false,
            },
        });
        return NextResponse.json(log, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create attendance log" }, { status: 500 });
    }
}
