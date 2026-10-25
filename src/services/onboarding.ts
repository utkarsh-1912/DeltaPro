import { prisma } from "@/lib/prisma";
import { audit, notify } from "@/lib/activity";
import { HttpError, isPeopleAdmin, type SessionUser } from "@/lib/api";
import { Role } from "@prisma/client";
import { assetsHeldBy } from "./assets";

export type ChecklistItem = { title: string; owner: "HR" | "MANAGER" | "EMPLOYEE" | "IT"; dueOffsetDays: number };

/** Used when an organization has no templates of its own yet. */
export const DEFAULT_TEMPLATES: Record<"ONBOARDING" | "OFFBOARDING", ChecklistItem[]> = {
    ONBOARDING: [
        { title: "Send offer letter and collect signed copy", owner: "HR", dueOffsetDays: -7 },
        { title: "Collect ID proof, PAN and bank details", owner: "EMPLOYEE", dueOffsetDays: 0 },
        { title: "Create email and system accounts", owner: "IT", dueOffsetDays: -1 },
        { title: "Assign laptop and access card", owner: "IT", dueOffsetDays: 0 },
        { title: "Add salary structure in payroll", owner: "HR", dueOffsetDays: 3 },
        { title: "Acknowledge company policies", owner: "EMPLOYEE", dueOffsetDays: 3 },
        { title: "Introduce the team and set first-month goals", owner: "MANAGER", dueOffsetDays: 5 },
        { title: "30-day check-in", owner: "MANAGER", dueOffsetDays: 30 },
    ],
    OFFBOARDING: [
        { title: "Accept resignation and confirm last working day", owner: "HR", dueOffsetDays: -30 },
        { title: "Knowledge transfer plan", owner: "MANAGER", dueOffsetDays: -14 },
        { title: "Exit interview", owner: "HR", dueOffsetDays: -3 },
        { title: "Revoke system access", owner: "IT", dueOffsetDays: 0 },
        { title: "Full and final settlement", owner: "HR", dueOffsetDays: 30 },
        { title: "Issue relieving and experience letters", owner: "HR", dueOffsetDays: 30 },
    ],
};

const assertHr = (actor: SessionUser) => {
    if (!isPeopleAdmin(actor)) throw new HttpError(403, "Only HR or an admin can manage onboarding.");
};

export async function listTemplates() {
    const custom = await prisma.checklistTemplate.findMany({ orderBy: { createdAt: "asc" } });
    return { templates: custom, defaults: DEFAULT_TEMPLATES };
}

export async function saveTemplate(actor: SessionUser, input: { id?: string; name: string; kind: "ONBOARDING" | "OFFBOARDING"; items: ChecklistItem[] }) {
    assertHr(actor);
    if (input.items.length === 0) throw new HttpError(400, "Add at least one task.");
    const data = { name: input.name, kind: input.kind, items: input.items };
    return input.id ? prisma.checklistTemplate.update({ where: { id: input.id }, data }) : prisma.checklistTemplate.create({ data });
}

export async function deleteTemplate(actor: SessionUser, id: string) {
    assertHr(actor);
    await prisma.checklistTemplate.delete({ where: { id } });
}

const INCLUDE = {
    user: { select: { id: true, name: true, email: true, image: true, managerId: true } },
    tasks: { orderBy: { sort: "asc" as const }, include: { assignee: { select: { id: true, name: true } } } },
};

/** HR sees every checklist; others see checklists they are the subject of or have tasks in. */
export function listChecklists(actor: SessionUser, opts: { status?: string | null }) {
    return prisma.checklist.findMany({
        where: {
            ...(opts.status ? { status: opts.status } : {}),
            ...(isPeopleAdmin(actor) ? {} : { OR: [{ userId: actor.id }, { tasks: { some: { assigneeId: actor.id } } }, { user: { managerId: actor.id } }] }),
        },
        include: INCLUDE,
        orderBy: { createdAt: "desc" },
    });
}

/** Open tasks assigned to the actor across all checklists. */
export const myChecklistTasks = (actor: SessionUser) =>
    prisma.checklistTask.findMany({
        where: { assigneeId: actor.id, done: false },
        include: { checklist: { select: { id: true, kind: true, user: { select: { id: true, name: true } } } } },
        orderBy: { dueDate: "asc" },
    });

/**
 * Starts onboarding or offboarding for an employee from a template (or the defaults). Owners map
 * to people: EMPLOYEE → the employee, MANAGER → their manager, HR → the actor, IT → the first admin.
 * Offboarding also adds a return task for every asset the employee holds.
 */
export async function startChecklist(actor: SessionUser, input: { userId: string; kind: "ONBOARDING" | "OFFBOARDING"; templateId?: string | null; startDate: string }) {
    assertHr(actor);
    const subject = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, name: true, managerId: true } });
    if (!subject) throw new HttpError(404, "Employee not found.");
    const open = await prisma.checklist.findFirst({ where: { userId: input.userId, kind: input.kind, status: "OPEN" } });
    if (open) throw new HttpError(409, `${subject.name ?? "This employee"} already has an open ${input.kind.toLowerCase()} checklist.`);

    let items = DEFAULT_TEMPLATES[input.kind];
    if (input.templateId) {
        const t = await prisma.checklistTemplate.findUnique({ where: { id: input.templateId } });
        if (!t || t.kind !== input.kind) throw new HttpError(400, "Template not found for this checklist type.");
        items = t.items as ChecklistItem[];
    }
    const start = new Date(input.startDate);
    if (Number.isNaN(start.getTime())) throw new HttpError(400, "Invalid start date.");
    const it = await prisma.user.findFirst({ where: { role: Role.ADMIN, isActive: true }, select: { id: true } });
    const ownerOf = (o: ChecklistItem["owner"]) => (o === "EMPLOYEE" ? subject.id : o === "MANAGER" ? subject.managerId ?? actor.id : o === "IT" ? it?.id ?? actor.id : actor.id);

    const tasks = items.map((item, i) => ({
        title: item.title, owner: item.owner, assigneeId: ownerOf(item.owner), sort: i,
        dueDate: new Date(start.getTime() + item.dueOffsetDays * 86400000),
    }));
    if (input.kind === "OFFBOARDING") {
        for (const a of await assetsHeldBy(subject.id)) {
            tasks.push({ title: `Return ${a.name} (${a.tag})`, owner: "IT", assigneeId: ownerOf("IT"), sort: tasks.length, dueDate: start });
        }
    }
    const checklist = await prisma.checklist.create({
        data: {
            userId: subject.id, kind: input.kind, templateId: input.templateId ?? null, startDate: start, createdById: actor.id,
            tasks: { create: tasks.map(t => ({ ...t, organizationId: actor.organizationId })) },
        },
        include: INCLUDE,
    });
    for (const assignee of new Set(tasks.map(t => t.assigneeId))) {
        if (assignee !== actor.id) await notify(prisma, assignee, `${input.kind === "ONBOARDING" ? "Onboarding" : "Offboarding"}: ${subject.name}`, "You have checklist tasks to complete.", "task");
    }
    await audit(prisma, actor.id, `checklist.${input.kind.toLowerCase()}_started`, "Checklist", checklist.id, { userId: subject.id });
    return checklist;
}

/** Tick or untick a task. Assignee, HR or admin only. Closes the checklist when every task is done. */
export async function setTaskDone(actor: SessionUser, taskId: string, done: boolean) {
    const task = await prisma.checklistTask.findUnique({ where: { id: taskId } });
    if (!task) throw new HttpError(404, "Task not found.");
    if (task.assigneeId !== actor.id && !isPeopleAdmin(actor)) throw new HttpError(403, "Only the assignee or HR can update this task.");
    await prisma.checklistTask.update({ where: { id: taskId }, data: { done, doneAt: done ? new Date() : null, doneById: done ? actor.id : null } });
    const remaining = await prisma.checklistTask.count({ where: { checklistId: task.checklistId, done: false } });
    await prisma.checklist.update({ where: { id: task.checklistId }, data: { status: remaining === 0 ? "DONE" : "OPEN", completedAt: remaining === 0 ? new Date() : null } });
    return prisma.checklist.findUnique({ where: { id: task.checklistId }, include: INCLUDE });
}

export async function reassignTask(actor: SessionUser, taskId: string, assigneeId: string) {
    assertHr(actor);
    return prisma.checklistTask.update({ where: { id: taskId }, data: { assigneeId } });
}
