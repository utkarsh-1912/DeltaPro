import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const projects = await prisma.project.findMany({
            include: {
                owner: true,
                team: {
                    include: {
                        members: true
                    }
                },
                tasks: true,
                _count: {
                    select: { tasks: true }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        // Calculate dynamic metrics for each project
        const projectsWithMetrics = projects.map(project => {
            const totalTasks = project.tasks.length;
            const completedTasks = project.tasks.filter(t => t.status === "DONE").length;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const memberCount = project.team?.members.length || 0;

            return {
                ...project,
                metrics: {
                    progress,
                    taskCount: totalTasks,
                    memberCount,
                    status: progress === 100 ? "Completed" : progress > 0 ? "In Progress" : "Not Started"
                }
            };
        });

        return NextResponse.json(projectsWithMetrics);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { name, key, description } = body;

        const project = await prisma.project.create({
            data: {
                name,
                key,
                description,
                ownerId: session.user.id
            }
        });

        return NextResponse.json(project);
    } catch (error) {
        return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }
}
