import { z } from "zod";
import { TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { parseBody, route } from "@/lib/api";
import { updateTask } from "@/services/tasks";
import { deleteTask } from "@/services/workspace";

export const dynamic = "force-dynamic";

const schema = z.object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().max(20000).nullable().optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    type: z.nativeEnum(TaskType).optional(),
    assigneeId: z.string().nullable().optional(),
});

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => updateTask(user, params.id, await parseBody(req, schema)));

/** Reporter, project owner or a manager can delete a task. */
export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    await deleteTask(user, params.id);
    return { ok: true };
});
