import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MANAGER_ROLES, isPeopleAdmin, parseBody, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = route(async () =>
    prisma.team.findMany({ include: { members: true, shifts: true }, orderBy: { name: "asc" } }),
);

const teamSchema = z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(100),
    pmId: z.string().nullable().optional(),
});

/** ADMIN/HR create any team; a PM's new team is always their own. */
export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, teamSchema);
    const pmId = user.role === Role.PM && !isPeopleAdmin(user) ? user.id : body.pmId && body.pmId !== "none" ? body.pmId : null;
    const team = await prisma.team.create({ data: { ...(body.id ? { id: body.id } : {}), name: body.name, pmId } });
    return Response.json(team, { status: 201 });
}, { roles: MANAGER_ROLES });
