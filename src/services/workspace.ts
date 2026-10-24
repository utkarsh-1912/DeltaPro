import { prisma } from "@/lib/prisma";
import { HttpError, assertTeamAccess, isManager, type SessionUser } from "@/lib/api";

const PERSON = { select: { id: true, name: true, email: true, image: true, role: true } } as const;

// ---------- Projects ----------

export async function listProjects() {
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
}

export async function createProject(actor: SessionUser, input: { name: string; key: string; description?: string | null; teamId?: string | null }) {
    if (input.teamId) await assertTeamAccess(actor, input.teamId);
    if (await prisma.project.findFirst({ where: { key: input.key } })) throw new HttpError(409, `Project key ${input.key} is already used.`);
    return prisma.project.create({
        data: { name: input.name, key: input.key, description: input.description ?? null, teamId: input.teamId || null, ownerId: actor.id },
    });
}

// ---------- Tasks (reads; writes live in tasks.ts) ----------

export function listTasks(filter: { projectId?: string | null; assigneeId?: string | null }) {
    return prisma.task.findMany({
        where: { ...(filter.projectId ? { projectId: filter.projectId } : {}), ...(filter.assigneeId ? { assigneeId: filter.assigneeId } : {}) },
        include: {
            project: true,
            assignee: PERSON,
            reporter: PERSON,
            taskComments: { include: { user: PERSON }, orderBy: { createdAt: "desc" } },
        },
        orderBy: { updatedAt: "desc" },
        take: 1000,
    });
}

/** Reporter, project owner or a manager can delete a task. */
export async function deleteTask(actor: SessionUser, id: string) {
    const task = await prisma.task.findUnique({ where: { id }, include: { project: { select: { ownerId: true } } } });
    if (!task) throw new HttpError(404, "Task not found.");
    if (!isManager(actor) && task.reporterId !== actor.id && task.project.ownerId !== actor.id) {
        throw new HttpError(403, "Only the reporter, project owner or a manager can delete this task.");
    }
    await prisma.task.delete({ where: { id } });
}

// ---------- Knowledge base ----------

export const listWorkspaces = () =>
    prisma.workspace.findMany({
        include: {
            owner: { select: { id: true, name: true, email: true, image: true } },
            pages: { orderBy: { updatedAt: "desc" } },
            _count: { select: { pages: true } },
        },
        orderBy: { updatedAt: "desc" },
    });

export const createWorkspace = (actor: SessionUser, input: { name: string; description?: string | null }) =>
    prisma.workspace.create({ data: { name: input.name, description: input.description ?? null, ownerId: actor.id } });

export async function createPage(actor: SessionUser, input: { title: string; content?: string; workspaceId: string; parentId?: string | null }) {
    const workspace = await prisma.workspace.findUnique({ where: { id: input.workspaceId } });
    if (!workspace) throw new HttpError(400, "Workspace not found.");
    if (input.parentId) {
        const parent = await prisma.page.findUnique({ where: { id: input.parentId } });
        if (!parent || parent.workspaceId !== input.workspaceId) throw new HttpError(400, "Parent page must be in the same workspace.");
    }
    const page = await prisma.page.create({
        data: { title: input.title, content: input.content || "Start writing...", workspaceId: input.workspaceId, parentId: input.parentId || null, authorId: actor.id },
    });
    await prisma.workspace.update({ where: { id: input.workspaceId }, data: { updatedAt: new Date() } });
    return page;
}

async function loadEditablePage(actor: SessionUser, id: string) {
    const page = await prisma.page.findUnique({ where: { id }, include: { workspace: { select: { ownerId: true } } } });
    if (!page) throw new HttpError(404, "Page not found.");
    if (page.authorId !== actor.id && page.workspace.ownerId !== actor.id && !isManager(actor)) {
        throw new HttpError(403, "Only the author, the workspace owner or a manager can change this page.");
    }
    return page;
}

export async function getPage(id: string) {
    const page = await prisma.page.findUnique({ where: { id }, include: { children: { select: { id: true, title: true } }, author: { select: { id: true, name: true } } } });
    if (!page) throw new HttpError(404, "Page not found.");
    return page;
}

export async function updatePage(actor: SessionUser, id: string, input: { title?: string; content?: string; parentId?: string | null }) {
    const page = await loadEditablePage(actor, id);
    if (input.parentId) {
        if (input.parentId === page.id) throw new HttpError(400, "A page cannot be its own parent.");
        const parent = await prisma.page.findUnique({ where: { id: input.parentId } });
        if (!parent || parent.workspaceId !== page.workspaceId) throw new HttpError(400, "Parent page must be in the same workspace.");
    }
    return prisma.page.update({ where: { id: page.id }, data: { title: input.title, content: input.content, parentId: input.parentId === undefined ? undefined : input.parentId } });
}

/** Child pages move up to the deleted page's parent. */
export async function deletePage(actor: SessionUser, id: string) {
    const page = await loadEditablePage(actor, id);
    await prisma.$transaction([
        prisma.page.updateMany({ where: { parentId: page.id }, data: { parentId: page.parentId } }),
        prisma.page.delete({ where: { id: page.id } }),
    ]);
}

// ---------- Notifications ----------

export const listNotifications = (actor: SessionUser) =>
    prisma.notification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 20 });

export async function markNotificationsRead(actor: SessionUser, id?: string | null) {
    if (id) await prisma.notification.updateMany({ where: { id, userId: actor.id }, data: { read: true } });
    else await prisma.notification.updateMany({ where: { userId: actor.id, read: false }, data: { read: true } });
}

export async function clearNotifications(actor: SessionUser, id?: string | null) {
    if (id) await prisma.notification.deleteMany({ where: { id, userId: actor.id } });
    else await prisma.notification.deleteMany({ where: { userId: actor.id } });
}

// ---------- Search ----------

export async function search(query: string) {
    if (!query || query.length < 2) return [];
    const ci = { contains: query, mode: "insensitive" as const };
    const [users, projects, tasks, workspaces] = await Promise.all([
        prisma.user.findMany({ where: { isActive: true, OR: [{ name: ci }, { email: ci }] }, select: { id: true, name: true, role: true }, take: 5 }),
        prisma.project.findMany({ where: { OR: [{ name: ci }, { key: ci }] }, select: { id: true, name: true, key: true }, take: 5 }),
        prisma.task.findMany({ where: { OR: [{ title: ci }, { key: ci }] }, select: { id: true, title: true, key: true, type: true }, take: 5 }),
        prisma.workspace.findMany({ where: { name: ci }, select: { id: true, name: true }, take: 5 }),
    ]);
    return [
        ...users.map(u => ({ id: u.id, label: u.name, category: "Employee", subLabel: u.role, href: "/employees" })),
        ...projects.map(p => ({ id: p.id, label: p.name, category: "Project", subLabel: p.key, href: "/projects" })),
        ...tasks.map(t => ({ id: t.id, label: t.title, category: "Task", subLabel: t.key, href: "/tasks" })),
        ...workspaces.map(w => ({ id: w.id, label: w.name, category: "Workspace", href: "/docs" })),
    ];
}

// ---------- Audit ----------

export const listAuditLog = (filter: { entityType?: string | null; entityId?: string | null; take?: number }) =>
    prisma.auditLog.findMany({
        where: { ...(filter.entityType ? { entityType: filter.entityType } : {}), ...(filter.entityId ? { entityId: filter.entityId } : {}) },
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: Math.min(500, filter.take || 100),
    });
