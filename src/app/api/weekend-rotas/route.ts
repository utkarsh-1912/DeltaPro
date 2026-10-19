import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, MANAGER_ROLES, assertTeamAccess, parseBody, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = route(async () => prisma.weekendRota.findMany({ orderBy: { date: "asc" } }));

const entry = z.object({ date: z.string(), memberId: z.string(), generationId: z.string() });
const schema = z.union([z.object({ rotas: z.array(entry) }), entry]);

async function assertGenerations(user: Parameters<typeof assertTeamAccess>[0], ids: string[]) {
    const gens = await prisma.rotaGeneration.findMany({ where: { id: { in: ids } }, select: { id: true, teamId: true } });
    if (gens.length !== new Set(ids).size) throw new HttpError(400, "Unknown rota generation.");
    for (const g of gens) await assertTeamAccess(user, g.teamId);
}

export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, schema);
    const rows = "rotas" in body ? body.rotas : [body];
    if (rows.length === 0) return Response.json({ count: 0 }, { status: 201 });
    await assertGenerations(user, rows.map(r => r.generationId));
    const created = await prisma.weekendRota.createMany({ data: rows });
    return Response.json(created, { status: 201 });
}, { roles: MANAGER_ROLES });

export const DELETE = route(async ({ req, user }) => {
    const generationId = new URL(req.url).searchParams.get("generationId");
    if (!generationId) throw new HttpError(400, "generationId is required");
    await assertGenerations(user, [generationId]);
    await prisma.weekendRota.deleteMany({ where: { generationId } });
    return { success: true };
}, { roles: MANAGER_ROLES });
