export const dynamic = 'force-dynamic';
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const log = await prisma.attendanceLog.findUnique({
            where: { id: params.id },
        });
        return NextResponse.json(log);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch log" }, { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { logoutTime, logoutLocation, latitude, longitude, accuracy, status } = body;

        const log = await prisma.attendanceLog.update({
            where: { id: params.id },
            data: {
                logoutTime: logoutTime ? new Date(logoutTime) : new Date(),
                logoutLocation: logoutLocation || "Remote",
                latitude: latitude || undefined,
                longitude: longitude || undefined,
                accuracy: accuracy || undefined,
                status: status || "LOGGED_OUT",
            },
        });

        return NextResponse.json(log);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update attendance log" }, { status: 500 });
    }
}
