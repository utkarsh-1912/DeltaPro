import { prisma } from "@/lib/prisma";
import type { Db } from "@/lib/activity";

/** Attach rota TeamMember rows to a login account with the same email. */
export async function linkTeamMembersToUser(userId: string, email: string | null | undefined, db: Db = prisma) {
    if (!email) return;
    await db.teamMember.updateMany({
        where: { email: { equals: email, mode: "insensitive" }, userId: null },
        data: { userId },
    });
}

/** Find the login account for a rota member email, if any. */
export async function findUserIdByEmail(email: string | null | undefined, db: Db = prisma): Promise<string | null> {
    if (!email) return null;
    const user = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
    return user?.id ?? null;
}
