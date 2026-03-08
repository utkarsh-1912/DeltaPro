import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { content } = body;

        if (!content) return NextResponse.json({ error: "Comment content is required" }, { status: 400 });

        const comment = await prisma.taskComment.create({
            data: {
                content,
                taskId: params.id,
                userId: session.user.id,
            },
            include: {
                user: true
            }
        });

        return NextResponse.json(comment);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
    }
}
