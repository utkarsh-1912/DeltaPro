import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, MANAGER_ROLES, assertTeamAccess, parseBody, route } from "@/lib/api";

export const dynamic = "force-dynamic";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

async function load(id: string) {
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift) throw new HttpError(404, "Shift not found.");
    return shift;
}

export const GET = route<{ id: string }>(async ({ params }) => load(params.id));

const schema = z.object({
    name: z.string().trim().min(1).max(60).optional(),
    startTime: time.optional(),
    endTime: time.optional(),
    sequence: z.number().int().min(0).optional(),
    isExtreme: z.boolean().optional(),
    minTeam: z.number().int().min(0).optional(),
    maxTeam: z.number().int().min(0).optional(),
    color: z.string().optional(),
}).strip();

export const PUT = route<{ id: string }>(async ({ req, user, params }) => {
    const shift = await load(params.id);
    await assertTeamAccess(user, shift.teamId);
    const body = await parseBody(req, schema);
    if ((body.maxTeam ?? shift.maxTeam) < (body.minTeam ?? shift.minTeam)) throw new HttpError(400, "maxTeam must be at least minTeam.");
    return prisma.shift.update({ where: { id: params.id }, data: body });
}, { roles: MANAGER_ROLES });

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    const shift = await load(params.id);
    await assertTeamAccess(user, shift.teamId);
    const fixed = await prisma.teamMember.count({ where: { fixedShiftId: params.id } });
    if (fixed > 0) throw new HttpError(409, "This shift is a team member's fixed shift. Change their fixed shift first.");
    await prisma.shift.delete({ where: { id: params.id } });
    return { ok: true };
}, { roles: MANAGER_ROLES });
