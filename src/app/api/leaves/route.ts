import { z } from "zod";
import { MANAGER_ROLES, parseBody, route } from "@/lib/api";
import { createRotaLeave, listRotaLeave } from "@/services/rota-admin";

export const dynamic = "force-dynamic";

/** Rota leave: manual entries plus approved leave requests of linked accounts ("lr_" ids, read-only). */
export const GET = route(async () => listRotaLeave());

const schema = z.object({ id: z.string().optional(), memberId: z.string(), startDate: z.string(), endDate: z.string(), type: z.string().min(1).max(40) });

export const POST = route(async ({ req, user }) => Response.json(await createRotaLeave(user, await parseBody(req, schema)), { status: 201 }), { roles: MANAGER_ROLES });
