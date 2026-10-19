import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, MANAGER_ROLES, assertTeamAccess, isPeopleAdmin, parseBody, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ params }) => {
    const team = await prisma.team.findUnique({ where: { id: params.id }, include: { members: true, shifts: true } });
    if (!team) throw new HttpError(404, "Team not found.");
    return team;
});

const schema = z.object({ name: z.string().trim().min(1).max(100).optional(), pmId: z.string().nullable().optional() });

export const PUT = route<{ id: string }>(async ({ req, user, params }) => {
    await assertTeamAccess(user, params.id);
    const body = await parseBody(req, schema);
    const current = await prisma.team.findUniqueOrThrow({ where: { id: params.id } });
    const nextPm = body.pmId === undefined ? undefined : body.pmId && body.pmId !== "none" ? body.pmId : null;
    if (nextPm !== undefined && nextPm !== current.pmId && !isPeopleAdmin(user)) {
        throw new HttpError(403, "Only HR or an admin can reassign the PM of a team.");
    }
    return prisma.team.update({ where: { id: params.id }, data: { name: body.name, pmId: nextPm } });
}, { roles: MANAGER_ROLES });

/** Deletes shifts and rotas with the team; members stay and become unassigned. */
export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    await assertTeamAccess(user, params.id);
    await prisma.$transaction([
        prisma.teamMember.updateMany({ where: { teamId: params.id }, data: { teamId: null, fixedShiftId: null } }),
        prisma.team.delete({ where: { id: params.id } }),
    ]);
    return { ok: true };
}, { roles: MANAGER_ROLES });
