import { Prisma, TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify, type Db } from "@/lib/activity";
import { HttpError, type SessionUser } from "@/lib/api";
import { emitEvent, scheduleDispatch, type EventType } from "@/integrations/events";
import { appBaseUrl } from "@/integrations/http";
import { person } from "./shared";

const TASK_INCLUDE = {
    project: true,
    assignee: true,
    reporter: true,
} satisfies Prisma.TaskInclude;

type FullTask = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

function taskData(t: FullTask, extra: Record<string, unknown> = {}) {
    return {
        task: {
            id: t.id,
            key: t.key,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            type: t.type,
            projectKey: t.project.key,
            projectName: t.project.name,
            url: `${appBaseUrl()}/tasks`,
        },
        assignee: person(t.assignee),
        reporter: person(t.reporter),
        ...extra,
    };
}

async function emitTask(db: Db, type: EventType, t: FullTask, actor: SessionUser | null, extra: Record<string, unknown> = {}, origin?: string | null) {
    await emitEvent(db, { type, subject: { type: "Task", id: t.id }, actor, origin, data: taskData(t, extra) });
}

/** Next key for a project: PROJ-1, PROJ-2 … based on the highest existing number. */
async function nextTaskKey(db: Db, projectId: string, projectKey: string): Promise<string> {
    const keys = await db.task.findMany({ where: { projectId }, select: { key: true } });
    const max = keys.reduce((m, { key }) => {
        const n = Number(key.split("-").pop());
        return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return `${projectKey}-${max + 1}`;
}

export type TaskInput = {
    title: string;
    description?: string | null;
    projectId: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    type?: TaskType;
    assigneeId?: string | null;
};

export async function createTask(actor: SessionUser, input: TaskInput) {
    const project = await prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw new HttpError(400, "Project not found.");

    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const task = await prisma.$transaction(async tx => {
                const created = await tx.task.create({
                    data: {
                        title: input.title,
                        description: input.description ?? null,
                        key: await nextTaskKey(tx, project.id, project.key),
                        projectId: project.id,
                        status: input.status ?? TaskStatus.TODO,
                        priority: input.priority ?? TaskPriority.MEDIUM,
                        type: input.type ?? TaskType.TASK,
                        reporterId: actor.id,
                        assigneeId: input.assigneeId || null,
                    },
                    include: TASK_INCLUDE,
                });
                await emitTask(tx, "task.created", created, actor);
                if (created.assigneeId && created.assigneeId !== actor.id) {
                    await notify(tx, created.assigneeId, "Task assigned", `${created.key}: ${created.title}`, "task");
                }
                return created;
            });
            scheduleDispatch();
            return task;
        } catch (e) {
            // Two creates raced for the same key: try the next number.
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
            throw e;
        }
    }
    throw new HttpError(409, "Could not allocate a task key. Try again.");
}

export type TaskPatch = Partial<Omit<TaskInput, "projectId">>;

export async function updateTask(actor: SessionUser | null, taskId: string, patch: TaskPatch, opts: { origin?: string | null } = {}) {
    const before = await prisma.task.findUnique({ where: { id: taskId } });
    if (!before) throw new HttpError(404, "Task not found.");

    const task = await prisma.$transaction(async tx => {
        const updated = await tx.task.update({
            where: { id: taskId },
            data: {
                title: patch.title,
                description: patch.description,
                status: patch.status,
                priority: patch.priority,
                type: patch.type,
                assigneeId: patch.assigneeId === undefined ? undefined : patch.assigneeId || null,
            },
            include: TASK_INCLUDE,
        });
        if (patch.status && patch.status !== before.status) {
            await emitTask(tx, "task.status_changed", updated, actor, { previousStatus: before.status }, opts.origin);
            if (updated.reporterId !== actor?.id) {
                await notify(tx, updated.reporterId, "Task status changed", `${updated.key} moved to ${updated.status.replace("_", " ").toLowerCase()}.`, "task");
            }
        }
        const fieldsChanged = (patch.title && patch.title !== before.title) || (patch.priority && patch.priority !== before.priority)
            || (patch.description !== undefined && patch.description !== before.description) || (patch.assigneeId !== undefined && (patch.assigneeId || null) !== before.assigneeId);
        if (fieldsChanged) await emitTask(tx, "task.updated", updated, actor, {}, opts.origin);
        if (patch.assigneeId && patch.assigneeId !== before.assigneeId && patch.assigneeId !== actor?.id) {
            await notify(tx, patch.assigneeId, "Task assigned", `${updated.key}: ${updated.title}`, "task");
        }
        return updated;
    });
    scheduleDispatch();
    return task;
}

export async function addTaskComment(author: { id: string } & Partial<SessionUser>, taskId: string, content: string, opts: { origin?: string | null } = {}) {
    if (!content?.trim()) throw new HttpError(400, "Comment content is required");
    const comment = await prisma.$transaction(async tx => {
        const created = await tx.taskComment.create({ data: { content: content.trim(), taskId, userId: author.id }, include: { user: true } });
        const task = await tx.task.findUniqueOrThrow({ where: { id: taskId }, include: TASK_INCLUDE });
        await emitTask(tx, "task.commented", task, author.role ? (author as SessionUser) : null, { comment: { body: created.content, author: person(created.user) } }, opts.origin);
        for (const uid of new Set([task.assigneeId, task.reporterId])) {
            if (uid && uid !== author.id) await notify(tx, uid, `New comment on ${task.key}`, created.content.slice(0, 140), "task");
        }
        return created;
    });
    scheduleDispatch();
    return comment;
}

export async function findTask(ref: { taskId?: string; taskKey?: string }) {
    if (ref.taskId) return prisma.task.findUnique({ where: { id: ref.taskId } });
    if (ref.taskKey) return prisma.task.findFirst({ where: { key: ref.taskKey } });
    return null;
}
