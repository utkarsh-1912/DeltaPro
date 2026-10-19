import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type Db = PrismaClient | Prisma.TransactionClient;

export type NotificationType = "success" | "alert" | "task" | "info";

export async function notify(
    db: Db,
    userId: string | null | undefined,
    title: string,
    description: string,
    type: NotificationType = "info",
) {
    if (!userId) return;
    await db.notification.create({ data: { userId, title, description, type } });
}

export async function audit(
    db: Db,
    actorId: string | null | undefined,
    action: string,
    entityType: string,
    entityId: string,
    data?: Prisma.InputJsonValue,
) {
    await db.auditLog.create({ data: { actorId: actorId ?? null, action, entityType, entityId, data } });
}

export { prisma };
