import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = route(async () =>
    prisma.workspace.findMany({
        include: {
            owner: { select: { id: true, name: true, email: true, image: true } },
            pages: { orderBy: { updatedAt: "desc" } },
            _count: { select: { pages: true } },
        },
        orderBy: { updatedAt: "desc" },
    }),
);

const schema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(1000).nullable().optional() });

export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, schema);
    const workspace = await prisma.workspace.create({ data: { name: body.name, description: body.description ?? null, ownerId: user.id } });
    return Response.json(workspace, { status: 201 });
});
