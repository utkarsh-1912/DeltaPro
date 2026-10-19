import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, assertTeamAccess, parseBody, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
    const projects = await prisma.project.findMany({
        include: {
            owner: { select: { id: true, name: true, email: true, image: true } },
            team: { include: { members: true } },
            tasks: { select: { id: true, status: true } },
            _count: { select: { tasks: true } },
        },
        orderBy: { updatedAt: "desc" },
    });

    return projects.map(project => {
        const totalTasks = project.tasks.length;
        const completedTasks = project.tasks.filter(t => t.status === "DONE").length;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        return {
            ...project,
            metrics: {
                progress,
                taskCount: totalTasks,
                memberCount: project.team?.members.length || 0,
                status: progress === 100 ? "Completed" : progress > 0 ? "In Progress" : "Not Started",
            },
        };
    });
});

const schema = z.object({
    name: z.string().trim().min(1).max(100),
    key: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{1,9}$/, "Key must be 2–10 letters or digits, starting with a letter."),
    description: z.string().max(2000).nullable().optional(),
    teamId: z.string().nullable().optional(),
});

export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, schema);
    if (body.teamId) await assertTeamAccess(user, body.teamId);
    if (await prisma.project.findUnique({ where: { key: body.key } })) throw new HttpError(409, `Project key ${body.key} is already used.`);
    const project = await prisma.project.create({
        data: { name: body.name, key: body.key, description: body.description ?? null, teamId: body.teamId || null, ownerId: user.id },
    });
    return Response.json(project, { status: 201 });
});
