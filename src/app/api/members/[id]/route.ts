import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, MANAGER_ROLES, assertTeamAccess, parseBody, route } from "@/lib/api";
import { findUserIdByEmail } from "@/lib/people";

export const dynamic = "force-dynamic";

async function load(id: string) {
    const member = await prisma.teamMember.findUnique({ where: { id } });
    if (!member) throw new HttpError(404, "Team member not found.");
    return member;
}

export const GET = route<{ id: string }>(async ({ params }) => load(params.id));

const schema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    email: z.string().email().optional(),
    teamId: z.string().nullable().optional(),
    fixedShiftId: z.string().nullable().optional(),
    lastShiftId: z.string().nullable().optional(),
});

export const PUT = route<{ id: string }>(async ({ req, user, params }) => {
    const member = await load(params.id);
    await assertTeamAccess(user, member.teamId);
    const body = await parseBody(req, schema);
    if (body.teamId !== undefined && body.teamId !== member.teamId) await assertTeamAccess(user, body.teamId);
    return prisma.teamMember.update({
        where: { id: params.id },
        data: {
            name: body.name,
            email: body.email,
            teamId: body.teamId === undefined ? undefined : body.teamId || null,
            fixedShiftId: body.fixedShiftId === undefined ? undefined : body.fixedShiftId || null,
            lastShiftId: body.lastShiftId === undefined ? undefined : body.lastShiftId || null,
            userId: body.email ? await findUserIdByEmail(body.email) : undefined,
        },
    });
}, { roles: MANAGER_ROLES });

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    const member = await load(params.id);
    await assertTeamAccess(user, member.teamId);
    await prisma.teamMember.delete({ where: { id: params.id } });
    return { ok: true };
}, { roles: MANAGER_ROLES });
