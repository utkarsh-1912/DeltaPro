import { z } from "zod";
import { HttpError, MANAGER_ROLES, parseBody, route } from "@/lib/api";
import { createWeekendRotas, deleteWeekendRotas, listWeekendRotas } from "@/services/rota-admin";

export const dynamic = "force-dynamic";

export const GET = route(async () => listWeekendRotas());

const entry = z.object({ date: z.string(), memberId: z.string(), generationId: z.string() });
const schema = z.union([z.object({ rotas: z.array(entry) }), entry]);

export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, schema);
    return Response.json(await createWeekendRotas(user, "rotas" in body ? body.rotas : [body]), { status: 201 });
}, { roles: MANAGER_ROLES });

export const DELETE = route(async ({ req, user }) => {
    const generationId = new URL(req.url).searchParams.get("generationId");
    if (!generationId) throw new HttpError(400, "generationId is required");
    await deleteWeekendRotas(user, generationId);
    return { success: true };
}, { roles: MANAGER_ROLES });
