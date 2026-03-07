import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const notifications = await prisma.notification.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: "desc" },
            take: 20
        });

        return NextResponse.json(notifications);
    } catch (error) {
        console.error("Notifications GET Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id, markAll } = await request.json();

        if (markAll) {
            await prisma.notification.updateMany({
                where: { userId: session.user.id, read: false },
                data: { read: true }
            });
        } else if (id) {
            await prisma.notification.update({
                where: { id, userId: session.user.id },
                data: { read: true }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Notifications PATCH Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const clearAll = searchParams.get("all") === "true";
        const id = searchParams.get("id");

        if (clearAll) {
            await prisma.notification.deleteMany({
                where: { userId: session.user.id }
            });
        } else if (id) {
            await prisma.notification.delete({
                where: { id, userId: session.user.id }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Notifications DELETE Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
