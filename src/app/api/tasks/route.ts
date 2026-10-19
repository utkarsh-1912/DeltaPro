import { z } from "zod";
import { TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseBody, route } from "@/lib/api";
import { createTask } from "@/services/tasks";

export const dynamic = "force-dynamic";

const PERSON = { select: { id: true, name: true, email: true, image: true, role: true } } as const;

export const GET = route(async ({ req }) => {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const assigneeId = searchParams.get("assigneeId");
    return prisma.task.findMany({
        where: { ...(projectId ? { projectId } : {}), ...(assigneeId ? { assigneeId } : {}) },
        include: {
            project: true,
            assignee: PERSON,
            reporter: PERSON,
            taskComments: { include: { user: PERSON }, orderBy: { createdAt: "desc" } },
        },
        orderBy: { updatedAt: "desc" },
        take: 1000,
    });
});

const schema = z.object({
    title: z.string().trim().min(1).max(300),
    description: z.string().max(20000).nullable().optional(),
    projectId: z.string(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    type: z.nativeEnum(TaskType).optional(),
    assigneeId: z.string().nullable().optional(),
});

export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, schema);
    return Response.json(await createTask(user, body), { status: 201 });
});
