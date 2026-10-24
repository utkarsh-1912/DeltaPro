import { z } from "zod";
import { TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { parseBody, route } from "@/lib/api";
import { createTask } from "@/services/tasks";
import { listTasks } from "@/services/workspace";

export const dynamic = "force-dynamic";

export const GET = route(async ({ req }) => {
    const p = new URL(req.url).searchParams;
    return listTasks({ projectId: p.get("projectId"), assigneeId: p.get("assigneeId") });
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

export const POST = route(async ({ req, user }) => Response.json(await createTask(user, await parseBody(req, schema)), { status: 201 }));
