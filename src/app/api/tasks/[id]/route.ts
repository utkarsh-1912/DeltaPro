import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { status, title, description, priority, type, assigneeId } = body;

        const task = await prisma.task.update({
            where: { id: params.id },
            data: {
                status,
                title,
                description,
                priority,
                type,
                assigneeId
            }
        });

        return NextResponse.json(task);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }
}
