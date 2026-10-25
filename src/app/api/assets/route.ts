import { z } from "zod";
import { PEOPLE_ADMIN_ROLES, parseBody, route } from "@/lib/api";
import { ASSET_CATEGORIES, createAsset, listAssets } from "@/services/assets";

export const dynamic = "force-dynamic";

export const GET = route(async ({ req, user }) => {
    const p = new URL(req.url).searchParams;
    return listAssets(user, { status: p.get("status"), q: p.get("q") });
}, { feature: "assets" });

const schema = z.object({
    tag: z.string().trim().max(30).optional(),
    name: z.string().trim().min(1).max(120),
    category: z.enum(ASSET_CATEGORIES),
    serialNumber: z.string().trim().max(80).nullable().optional(),
    purchaseDate: z.string().nullable().optional(),
    cost: z.number().nonnegative().nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
});

export const POST = route(async ({ req, user }) => Response.json(await createAsset(user, await parseBody(req, schema)), { status: 201 }), { roles: PEOPLE_ADMIN_ROLES, feature: "assets" });
