import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { createPage } from "@/services/workspace";

export const dynamic = "force-dynamic";

const schema = z.object({
    title: z.string().trim().min(1).max(200),
    content: z.string().max(200000).optional(),
    workspaceId: z.string(),
    parentId: z.string().nullable().optional(),
});

export const POST = route(async ({ req, user }) => Response.json(await createPage(user, await parseBody(req, schema)), { status: 201 }));
