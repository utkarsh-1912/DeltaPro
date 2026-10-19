import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { addTaskComment } from "@/services/tasks";

export const dynamic = "force-dynamic";

const schema = z.object({ content: z.string().trim().min(1, "Comment content is required").max(10000) });

export const POST = route<{ id: string }>(async ({ req, user, params }) => {
    const { content } = await parseBody(req, schema);
    return addTaskComment(user, params.id, content);
});
