import { z } from "zod";
import { MANAGER_ROLES, parseBody, route } from "@/lib/api";
import { createShift, listShifts } from "@/services/rota-admin";

export const dynamic = "force-dynamic";
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

export const GET = route(async () => listShifts());

const schema = z.object({
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

export const POST = route(async ({ req, user }) => Response.json(await createShift(user, await parseBody(req, schema)), { status: 201 }), { roles: MANAGER_ROLES });
