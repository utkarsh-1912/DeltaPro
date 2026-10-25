import { prisma, type Db } from "@/lib/prisma";
import { notify } from "@/lib/activity";
import { HttpError, isPeopleAdmin, type SessionUser } from "@/lib/api";

export const ASSET_CATEGORIES = ["LAPTOP", "MONITOR", "PHONE", "ACCESS_CARD", "HEADSET", "FURNITURE", "OTHER"] as const;
const assertAssetAdmin = (actor: SessionUser) => {
    if (!isPeopleAdmin(actor)) throw new HttpError(403, "Only HR or an admin can manage assets.");
};

/** HR/ADMIN see the register; everyone else sees what is assigned to them. */
export function listAssets(actor: SessionUser, opts: { status?: string | null; q?: string | null }) {
    const ci = opts.q ? { contains: opts.q, mode: "insensitive" as const } : undefined;
    return prisma.asset.findMany({
        where: {
            ...(isPeopleAdmin(actor) ? {} : { assignedToId: actor.id }),
            ...(opts.status ? { status: opts.status } : {}),
            ...(ci ? { OR: [{ name: ci }, { tag: ci }, { serialNumber: ci }] } : {}),
        },
        include: { assignedTo: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: { tag: "asc" },
    });
}

export async function getAsset(actor: SessionUser, id: string) {
    const asset = await prisma.asset.findUnique({ where: { id }, include: { assignedTo: { select: { id: true, name: true, email: true } }, events: { orderBy: { at: "desc" }, take: 50 } } });
    if (!asset) throw new HttpError(404, "Asset not found.");
    if (!isPeopleAdmin(actor) && asset.assignedToId !== actor.id) throw new HttpError(403, "Forbidden");
    return asset;
}

export type AssetInput = { tag?: string; name: string; category: string; serialNumber?: string | null; purchaseDate?: string | null; cost?: number | null; notes?: string | null };

async function nextTag(category: string) {
    const prefix = category.slice(0, 3).toUpperCase();
    const count = await prisma.asset.count({ where: { tag: { startsWith: `${prefix}-` } } });
    return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

export async function createAsset(actor: SessionUser, input: AssetInput) {
    assertAssetAdmin(actor);
    const asset = await prisma.asset.create({
        data: {
            tag: input.tag?.trim().toUpperCase() || (await nextTag(input.category)),
            name: input.name, category: input.category, serialNumber: input.serialNumber ?? null,
            purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null, cost: input.cost ?? null, notes: input.notes ?? null,
        },
    });
    await prisma.assetEvent.create({ data: { assetId: asset.id, type: "CREATED", actorId: actor.id } });
    return asset;
}

export async function updateAsset(actor: SessionUser, id: string, input: Partial<AssetInput> & { status?: string }) {
    assertAssetAdmin(actor);
    const before = await prisma.asset.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, "Asset not found.");
    if (input.status && ["IN_REPAIR", "RETIRED"].includes(input.status) && before.assignedToId) {
        throw new HttpError(409, "Return the asset before sending it for repair or retiring it.");
    }
    const asset = await prisma.asset.update({
        where: { id },
        data: {
            name: input.name, category: input.category, serialNumber: input.serialNumber, notes: input.notes, cost: input.cost,
            purchaseDate: input.purchaseDate === undefined ? undefined : input.purchaseDate ? new Date(input.purchaseDate) : null,
            status: input.status,
        },
    });
    if (input.status && input.status !== before.status && ["IN_REPAIR", "RETIRED", "AVAILABLE"].includes(input.status)) {
        await prisma.assetEvent.create({ data: { assetId: id, type: input.status === "IN_REPAIR" ? "REPAIR" : input.status === "RETIRED" ? "RETIRED" : "RETURNED", actorId: actor.id } });
    }
    return asset;
}

export async function assignAsset(actor: SessionUser, id: string, userId: string, note?: string | null) {
    assertAssetAdmin(actor);
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new HttpError(404, "Asset not found.");
    if (asset.status !== "AVAILABLE") throw new HttpError(409, `This asset is ${asset.status.toLowerCase().replace("_", " ")}.`);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } });
    if (!user?.isActive) throw new HttpError(400, "Choose an active employee.");
    const updated = await prisma.asset.update({ where: { id }, data: { status: "ASSIGNED", assignedToId: userId, assignedAt: new Date() } });
    await prisma.assetEvent.create({ data: { assetId: id, type: "ASSIGNED", userId, actorId: actor.id, note: note ?? null } });
    await notify(prisma, userId, "Asset assigned", `${asset.name} (${asset.tag}) is now assigned to you.`, "info");
    return updated;
}

export async function returnAsset(actor: SessionUser, id: string, note?: string | null, db: Db = prisma) {
    if (!isPeopleAdmin(actor)) throw new HttpError(403, "Only HR or an admin can record returns.");
    const asset = await db.asset.findUnique({ where: { id } });
    if (!asset) throw new HttpError(404, "Asset not found.");
    if (asset.status !== "ASSIGNED") throw new HttpError(409, "This asset is not assigned.");
    await db.asset.update({ where: { id }, data: { status: "AVAILABLE", assignedToId: null, assignedAt: null } });
    await db.assetEvent.create({ data: { assetId: id, type: "RETURNED", userId: asset.assignedToId, actorId: actor.id, note: note ?? null } });
}

export const assetsHeldBy = (userId: string) => prisma.asset.findMany({ where: { assignedToId: userId, status: "ASSIGNED" } });
