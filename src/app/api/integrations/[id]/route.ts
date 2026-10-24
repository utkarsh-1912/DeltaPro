import { z } from "zod";
import { Role } from "@prisma/client";
import { parseBody, route } from "@/lib/api";
import { deleteIntegration, getIntegration, updateIntegration } from "@/integrations/manage";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ params }) => getIntegration(params.id), { roles: [Role.ADMIN] });

const schema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    enabled: z.boolean().optional(),
    config: z.record(z.any()).optional(),
    /** Empty strings keep the stored value; null clears it. */
    credentials: z.record(z.any()).optional(),
    events: z.array(z.string()).optional(),
});

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => updateIntegration(user, params.id, await parseBody(req, schema)), { roles: [Role.ADMIN] });

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    await deleteIntegration(user, params.id);
    return { ok: true };
}, { roles: [Role.ADMIN] });
