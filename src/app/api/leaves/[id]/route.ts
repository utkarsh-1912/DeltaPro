import { prisma } from "@/lib/prisma";
import { HttpError, MANAGER_ROLES, assertTeamAccess, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ params }) => {
    const leave = await prisma.leave.findUnique({ where: { id: params.id } });
    if (!leave) throw new HttpError(404, "Leave not found.");
    return leave;
});

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    if (params.id.startsWith("lr_")) throw new HttpError(409, "This leave comes from an approved leave request. Cancel it on the Leave page.");
    const leave = await prisma.leave.findUnique({ where: { id: params.id }, include: { member: true } });
    if (!leave) throw new HttpError(404, "Leave not found.");
    await assertTeamAccess(user, leave.member.teamId);
    await prisma.leave.delete({ where: { id: params.id } });
    return { ok: true };
}, { roles: MANAGER_ROLES });
