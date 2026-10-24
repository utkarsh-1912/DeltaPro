import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { createWorkspace, listWorkspaces } from "@/services/workspace";

export const dynamic = "force-dynamic";

export const GET = route(async () => listWorkspaces());

const schema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(1000).nullable().optional() });

export const POST = route(async ({ req, user }) => Response.json(await createWorkspace(user, await parseBody(req, schema)), { status: 201 }));
