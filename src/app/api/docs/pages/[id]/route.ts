import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, isManager, parseBody, route, type SessionUser } from "@/lib/api";

export const dynamic = "force-dynamic";

async function loadEditable(user: SessionUser, id: string) {
    const page = await prisma.page.findUnique({ where: { id }, include: { workspace: { select: { ownerId: true } } } });
    if (!page) throw new HttpError(404, "Page not found.");
    if (page.authorId !== user.id && page.workspace.ownerId !== user.id && !isManager(user)) {
        throw new HttpError(403, "Only the author, the workspace owner or a manager can change this page.");
    }
    return page;
}

export const GET = route<{ id: string }>(async ({ params }) => {
    const page = await prisma.page.findUnique({ where: { id: params.id }, include: { children: { select: { id: true, title: true } }, author: { select: { id: true, name: true } } } });
    if (!page) throw new HttpError(404, "Page not found.");
    return page;
});

const schema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().max(200000).optional(),
    parentId: z.string().nullable().optional(),
});

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
    const page = await loadEditable(user, params.id);
    const body = await parseBody(req, schema);
    if (body.parentId) {
        if (body.parentId === page.id) throw new HttpError(400, "A page cannot be its own parent.");
        const parent = await prisma.page.findUnique({ where: { id: body.parentId } });
        if (!parent || parent.workspaceId !== page.workspaceId) throw new HttpError(400, "Parent page must be in the same workspace.");
    }
    return prisma.page.update({ where: { id: page.id }, data: { title: body.title, content: body.content, parentId: body.parentId === undefined ? undefined : body.parentId } });
});

/** Child pages move up to the deleted page's parent. */
export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    const page = await loadEditable(user, params.id);
    await prisma.$transaction([
        prisma.page.updateMany({ where: { parentId: page.id }, data: { parentId: page.parentId } }),
        prisma.page.delete({ where: { id: page.id } }),
    ]);
    return { ok: true };
});
