import { z } from "zod";
import { MANAGER_ROLES, parseBody, route } from "@/lib/api";
import { createRota, listRotas } from "@/services/rota-admin";

export const dynamic = "force-dynamic";

export const GET = route(async () => listRotas());

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

/** Saves a generated rota and publishes rota.published to calendar and chat connectors. */
export const POST = route(async ({ req, user }) => Response.json(await createRota(user, await parseBody(req, schema)), { status: 201 }), { roles: MANAGER_ROLES });
