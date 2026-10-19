import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MANAGER_ROLES, assertTeamAccess, parseBody, route } from "@/lib/api";
import { emitRotaEvent } from "@/services/rota";

export const dynamic = "force-dynamic";

export const GET = route(async () =>
    prisma.rotaGeneration.findMany({ include: { weekendRotas: true }, orderBy: { startDate: "desc" } }),
);

const json = z.any().optional();

const schema = z.object({
    id: z.string().optional(),
    startDate: z.string(),
    endDate: z.string(),
    teamId: z.string(),
    assignments: z.record(z.string().nullable().optional()).default({}),
    teamMembersAtGeneration: json,
    manualOverrides: json,
    manualSwaps: json,
    manualWeekendSwaps: json,
    comments: json,
    adhoc: json,
});

const asJson = (v: unknown, fallback: Prisma.InputJsonValue | typeof Prisma.JsonNull) =>
    v === undefined || v === null ? fallback : (v as Prisma.InputJsonValue);

/** Saves a generated rota and publishes rota.published to calendar and chat connectors. */
export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, schema);
    await assertTeamAccess(user, body.teamId);
    const rota = await prisma.rotaGeneration.create({
        data: {
            ...(body.id ? { id: body.id } : {}),
            startDate: body.startDate,
            endDate: body.endDate,
            teamId: body.teamId,
            assignments: body.assignments as Prisma.InputJsonValue,
            teamMembersAtGeneration: asJson(body.teamMembersAtGeneration, Prisma.JsonNull),
            manualOverrides: asJson(body.manualOverrides, []),
            manualSwaps: asJson(body.manualSwaps, []),
            manualWeekendSwaps: asJson(body.manualWeekendSwaps, []),
            comments: asJson(body.comments, {}),
            adhoc: asJson(body.adhoc, Prisma.JsonNull),
        },
    });
    await emitRotaEvent("rota.published", rota, user);
    return Response.json(rota, { status: 201 });
}, { roles: MANAGER_ROLES });
