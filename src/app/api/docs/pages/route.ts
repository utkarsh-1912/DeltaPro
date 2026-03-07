import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { title, content, workspaceId, parentId } = body;

        const page = await prisma.page.create({
            data: {
                title,
                content: content || "Start writing...",
                workspaceId,
                parentId,
                authorId: session.user.id
            }
        });

        return NextResponse.json(page);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create page" }, { status: 500 });
    }
}
