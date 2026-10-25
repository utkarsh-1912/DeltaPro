import { z } from "zod";
import { PEOPLE_ADMIN_ROLES, parseBody, route } from "@/lib/api";
import { assignAsset, returnAsset } from "@/services/assets";

export const dynamic = "force-dynamic";

const schema = z.object({ userId: z.string().nullable(), note: z.string().max(500).nullable().optional() });

/** { userId } assigns; { userId: null } records a return. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
    const { userId, note } = await parseBody(req, schema);
    if (userId) return assignAsset(user, params.id, userId, note);
    await returnAsset(user, params.id, note);
    return { ok: true };
}, { roles: PEOPLE_ADMIN_ROLES, feature: "assets" });
