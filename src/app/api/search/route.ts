import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get("q");

        if (!query || query.length < 2) {
            return NextResponse.json([]);
        }

        // Search multiple modules in parallel
        const [users, projects, tasks, workspaces] = await Promise.all([
            prisma.user.findMany({
                where: {
                    OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        { email: { contains: query, mode: "insensitive" } }
                    ]
                },
                select: { id: true, name: true, role: true },
                take: 5
            }),
            prisma.project.findMany({
                where: {
                    OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        { key: { contains: query, mode: "insensitive" } }
                    ]
                },
                select: { id: true, name: true, key: true },
                take: 5
            }),
            prisma.task.findMany({
                where: {
                    OR: [
                        { title: { contains: query, mode: "insensitive" } },
                        { key: { contains: query, mode: "insensitive" } }
                    ]
                },
                select: { id: true, title: true, key: true, type: true },
                take: 5
            }),
            prisma.workspace.findMany({
                where: { name: { contains: query, mode: "insensitive" } },
                select: { id: true, name: true },
                take: 5
            })
        ]);

        // Format results for the frontend GlobalSearch
        const results = [
            ...users.map(u => ({ id: u.id, label: u.name, category: "Employee", subLabel: u.role, href: "/employees" })),
            ...projects.map(p => ({ id: p.id, label: p.name, category: "Project", subLabel: p.key, href: "/projects" })),
            ...tasks.map(t => ({ id: t.id, label: t.title, category: "Task", subLabel: t.key, href: "/tasks" })),
            ...workspaces.map(w => ({ id: w.id, label: w.name, category: "Workspace", href: "/docs" }))
        ];

        return NextResponse.json(results);
    } catch (error) {
        console.error("Search API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
