import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const tasks = await prisma.task.findMany({
            include: {
                project: true,
                assignee: true,
                reporter: true,
                taskComments: {
                    include: {
                        user: true
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });
        return NextResponse.json(tasks);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { title, description, projectId, status, priority, type, assigneeId } = body;

        const taskCount = await prisma.task.count({ where: { projectId } });
        const key = (taskCount + 1).toString();

        const task = await prisma.task.create({
            data: {
                title,
                description,
                key,
                projectId,
                status: status || "TODO",
                priority: priority || "MEDIUM",
                type: type || "TASK",
                reporterId: session.user.id,
                assigneeId,
            }
        });

        return NextResponse.json(task);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }
}
