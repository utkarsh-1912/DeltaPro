import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const workspaces = await prisma.workspace.findMany({
            include: {
                owner: true,
                pages: {
                    orderBy: { updatedAt: 'desc' }
                },
                _count: {
                    select: { pages: true }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });
        return NextResponse.json(workspaces);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch workspaces" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { name, description } = body;

        const workspace = await prisma.workspace.create({
            data: {
                name,
                description,
                ownerId: session.user.id
            }
        });

        return NextResponse.json(workspace);
    } catch (error) {
        return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
    }
}
