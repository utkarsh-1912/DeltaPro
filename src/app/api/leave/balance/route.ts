import { route } from "@/lib/api";
import { getBalances } from "@/services/leave";

export const dynamic = 'force-dynamic';

/** GET /api/leave/balance[?year=2026&userId=…] — creates default balances for the year on first read. */
export const GET = route(async ({ req, user }) => {
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year")) || new Date().getFullYear();
    return getBalances(user, searchParams.get("userId") || user.id, year);
});
