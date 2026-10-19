import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MANAGER_ROLES, assertTeamAccess, parseBody, route } from "@/lib/api";
import { findUserIdByEmail } from "@/lib/people";

export const dynamic = "force-dynamic";

export const GET = route(async () => prisma.teamMember.findMany({ orderBy: { name: "asc" } }));

const schema = z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(100),
    email: z.string().email(),
    teamId: z.string().nullable().optional(),
    fixedShiftId: z.string().nullable().optional(),
    lastShiftId: z.string().nullable().optional(),
});

export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, schema);
    await assertTeamAccess(user, body.teamId);
    const member = await prisma.teamMember.create({
        data: {
            ...(body.id ? { id: body.id } : {}),
            name: body.name,
            email: body.email,
            teamId: body.teamId || null,
            fixedShiftId: body.fixedShiftId || null,
            lastShiftId: body.lastShiftId || null,
            userId: await findUserIdByEmail(body.email),
        },
    });
    return Response.json(member, { status: 201 });
}, { roles: MANAGER_ROLES });
