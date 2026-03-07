import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";

export async function GET() {
    try {
        let settings = await prisma.attendanceSettings.findFirst();
        if (!settings) {
            settings = await prisma.attendanceSettings.create({
                data: {
                    geofencingEnabled: true,
                    officeLat: 19.0760,
                    officeLng: 72.8777,
                    allowedRadius: 500,
                    wfhAllowed: true
                }
            });
        }
        return NextResponse.json(settings);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch attendance settings" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = session.user.role;
    if (role !== Role.ADMIN && role !== Role.HR) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const settings = await prisma.attendanceSettings.findFirst();

        let updated;
        if (settings) {
            updated = await prisma.attendanceSettings.update({
                where: { id: settings.id },
                data: body
            });
        } else {
            updated = await prisma.attendanceSettings.create({
                data: body
            });
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update attendance settings" }, { status: 500 });
    }
}
