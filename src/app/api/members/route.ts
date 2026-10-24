import { z } from "zod";
import { MANAGER_ROLES, parseBody, route } from "@/lib/api";
import { createMember, listMembers } from "@/services/rota-admin";

export const dynamic = "force-dynamic";

export const GET = route(async () => listMembers());

const schema = z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(100),
    email: z.string().email(),
    teamId: z.string().nullable().optional(),
    fixedShiftId: z.string().nullable().optional(),
    lastShiftId: z.string().nullable().optional(),
});

export const POST = route(async ({ req, user }) => Response.json(await createMember(user, await parseBody(req, schema)), { status: 201 }), { roles: MANAGER_ROLES });
