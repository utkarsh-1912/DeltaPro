import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { createProject, listProjects } from "@/services/workspace";

export const dynamic = "force-dynamic";

export const GET = route(async () => listProjects());

const schema = z.object({
    name: z.string().trim().min(1).max(100),
    key: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{1,9}$/, "Key must be 2–10 letters or digits, starting with a letter."),
    description: z.string().max(2000).nullable().optional(),
    teamId: z.string().nullable().optional(),
});

export const POST = route(async ({ req, user }) => Response.json(await createProject(user, await parseBody(req, schema)), { status: 201 }));
