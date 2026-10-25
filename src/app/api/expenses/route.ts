import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { EXPENSE_CATEGORIES, listExpenseClaims, submitExpenseClaim } from "@/services/expenses";

export const dynamic = "force-dynamic";

/** ?mine=true for own claims only; ?status=SUBMITTED|APPROVED|… */
export const GET = route(async ({ req, user }) => {
    const p = new URL(req.url).searchParams;
    return listExpenseClaims(user, { mine: p.get("mine") === "true", status: p.get("status") });
}, { feature: "expenses" });

const schema = z.object({
    title: z.string().trim().min(2).max(200),
    category: z.enum(EXPENSE_CATEGORIES),
    amount: z.number().positive().max(10_000_000),
    currency: z.string().length(3).optional(),
    spentOn: z.string(),
    description: z.string().max(2000).nullable().optional(),
    receiptId: z.string().nullable().optional(),
});

export const POST = route(async ({ req, user }) => Response.json(await submitExpenseClaim(user, await parseBody(req, schema)), { status: 201 }), { feature: "expenses" });
