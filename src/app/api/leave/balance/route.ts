import { prisma } from "@/lib/prisma";
import { HttpError, canActOnUser, route } from "@/lib/api";
import { ensureBalances } from "@/services/leave";

export const dynamic = 'force-dynamic';

/** GET /api/leave/balance[?year=2026&userId=…] — creates default balances for the year on first read. */
export const GET = route(async ({ req, user }) => {
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year")) || new Date().getFullYear();
    const userId = searchParams.get("userId") || user.id;
    if (userId !== user.id && !(await canActOnUser(user, userId))) throw new HttpError(403, "Forbidden");

    await ensureBalances(userId, year);
    return prisma.leaveBalance.findMany({ where: { userId, year }, orderBy: { type: "asc" } });
});
