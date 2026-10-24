import { z } from "zod";
import { MANAGER_ROLES, parseBody, route } from "@/lib/api";
import { createTeam, listTeams } from "@/services/rota-admin";

export const dynamic = "force-dynamic";

export const GET = route(async () => listTeams());

const schema = z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(100), pmId: z.string().nullable().optional() });

export const POST = route(async ({ req, user }) => Response.json(await createTeam(user, await parseBody(req, schema)), { status: 201 }), { roles: MANAGER_ROLES });
