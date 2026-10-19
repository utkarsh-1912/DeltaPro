import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, parseBody, route } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
    title: z.string().trim().min(1).max(200),
    content: z.string().max(200000).optional(),
    workspaceId: z.string(),
    parentId: z.string().nullable().optional(),
});

export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, schema);
    const workspace = await prisma.workspace.findUnique({ where: { id: body.workspaceId } });
    if (!workspace) throw new HttpError(400, "Workspace not found.");
    if (body.parentId) {
        const parent = await prisma.page.findUnique({ where: { id: body.parentId } });
        if (!parent || parent.workspaceId !== body.workspaceId) throw new HttpError(400, "Parent page must be in the same workspace.");
    }
    const page = await prisma.page.create({
        data: { title: body.title, content: body.content || "Start writing...", workspaceId: body.workspaceId, parentId: body.parentId || null, authorId: user.id },
    });
    await prisma.workspace.update({ where: { id: body.workspaceId }, data: { updatedAt: new Date() } });
    return Response.json(page, { status: 201 });
});
