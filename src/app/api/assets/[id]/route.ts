import { z } from "zod";
import { PEOPLE_ADMIN_ROLES, parseBody, route } from "@/lib/api";
import { ASSET_CATEGORIES, getAsset, updateAsset } from "@/services/assets";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ user, params }) => getAsset(user, params.id), { feature: "assets" });

const schema = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    category: z.enum(ASSET_CATEGORIES).optional(),
    serialNumber: z.string().trim().max(80).nullable().optional(),
    purchaseDate: z.string().nullable().optional(),
    cost: z.number().nonnegative().nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    status: z.enum(["AVAILABLE", "IN_REPAIR", "RETIRED"]).optional(),
});

export const PATCH = route<{ id: string }>(async ({ req, user, params }) => updateAsset(user, params.id, await parseBody(req, schema)), { roles: PEOPLE_ADMIN_ROLES, feature: "assets" });
