import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MANAGER_ROLES, assertTeamAccess, parseBody, route } from "@/lib/api";

export const dynamic = "force-dynamic";

const SHIFT_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

export const GET = route(async () => prisma.shift.findMany({ orderBy: { sequence: "asc" } }));

const shiftSchema = z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(60),
    startTime: time,
    endTime: time,
    sequence: z.number().int().min(0),
    isExtreme: z.boolean().default(false),
    minTeam: z.number().int().min(0),
    maxTeam: z.number().int().min(0),
    teamId: z.string(),
    color: z.string().optional(),
}).refine(s => s.maxTeam >= s.minTeam, { message: "maxTeam must be at least minTeam", path: ["maxTeam"] });

export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, shiftSchema);
    await assertTeamAccess(user, body.teamId);
    const existingCount = await prisma.shift.count({ where: { teamId: body.teamId } });
    const shift = await prisma.shift.create({
        data: { ...body, color: body.color ?? SHIFT_COLORS[existingCount % SHIFT_COLORS.length] },
    });
    return Response.json(shift, { status: 201 });
}, { roles: MANAGER_ROLES });
