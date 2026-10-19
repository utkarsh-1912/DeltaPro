import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError, MANAGER_ROLES, assertTeamAccess, parseBody, route } from "@/lib/api";
import { emitRotaEvent } from "@/services/rota";

export const dynamic = "force-dynamic";

async function load(id: string) {
    const rota = await prisma.rotaGeneration.findUnique({ where: { id }, include: { weekendRotas: true } });
    if (!rota) throw new HttpError(404, "Rota not found.");
    return rota;
}

export const GET = route<{ id: string }>(async ({ params }) => load(params.id));

const json = z.any().optional();
const schema = z.object({
    assignments: z.record(z.string().nullable().optional()).optional(),
    manualOverrides: json,
    manualSwaps: json,
    manualWeekendSwaps: json,
    comments: json,
    adhoc: json,
});

const opt = (v: unknown) => (v === undefined ? undefined : v === null ? Prisma.JsonNull : (v as Prisma.InputJsonValue));

/** Partial update from the rota editor (assignments, swaps, comments, ad-hoc support). */
export const PUT = route<{ id: string }>(async ({ req, user, params }) => {
    const rota = await load(params.id);
    await assertTeamAccess(user, rota.teamId);
    const body = await parseBody(req, schema);
    const updated = await prisma.rotaGeneration.update({
        where: { id: params.id },
        data: {
            assignments: body.assignments === undefined ? undefined : (body.assignments as Prisma.InputJsonValue),
            manualOverrides: opt(body.manualOverrides),
            manualSwaps: opt(body.manualSwaps),
            manualWeekendSwaps: opt(body.manualWeekendSwaps),
            comments: opt(body.comments),
            adhoc: opt(body.adhoc),
        },
    });
    if (body.assignments && JSON.stringify(body.assignments) !== JSON.stringify(rota.assignments)) {
        await emitRotaEvent("rota.updated", updated, user);
    }
    return updated;
}, { roles: MANAGER_ROLES });

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    const rota = await load(params.id);
    await assertTeamAccess(user, rota.teamId);
    await prisma.$transaction(async tx => {
        await emitRotaEvent("rota.deleted", rota, user, tx);
        await tx.rotaGeneration.delete({ where: { id: params.id } });
    });
    return { ok: true };
}, { roles: MANAGER_ROLES });
