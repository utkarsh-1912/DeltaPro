import { z } from "zod";
import { TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError, isManager, parseBody, route } from "@/lib/api";
import { updateTask } from "@/services/tasks";

export const dynamic = "force-dynamic";

const schema = z.object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().max(20000).nullable().optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    type: z.nativeEnum(TaskType).optional(),
    assigneeId: z.string().nullable().optional(),
});

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
    const body = await parseBody(req, schema);
    return updateTask(user, params.id, body);
});

/** Reporter, project owner or a manager can delete a task. */
export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    const task = await prisma.task.findUnique({ where: { id: params.id }, include: { project: { select: { ownerId: true } } } });
    if (!task) throw new HttpError(404, "Task not found.");
    if (!isManager(user) && task.reporterId !== user.id && task.project.ownerId !== user.id) throw new HttpError(403, "Only the reporter, project owner or a manager can delete this task.");
    await prisma.task.delete({ where: { id: params.id } });
    return { ok: true };
});
