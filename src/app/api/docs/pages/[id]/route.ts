import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { deletePage, getPage, updatePage } from "@/services/workspace";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ params }) => getPage(params.id));

const schema = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().max(200000).optional(),
    parentId: z.string().nullable().optional(),
});

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => updatePage(user, params.id, await parseBody(req, schema)));

/** Child pages move up to the deleted page's parent. */
export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    await deletePage(user, params.id);
    return { ok: true };
});
