import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { cancelExpenseClaim, decideExpenseClaim, markReimbursed } from "@/services/expenses";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["approve", "reject", "cancel", "reimburse"]), note: z.string().max(500).nullable().optional() });

/** approve / reject: the claimant's manager, HR or admin. cancel: the claimant. reimburse: HR (paid outside payroll). */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
    const { action, note } = await parseBody(req, schema);
    if (action === "cancel") await cancelExpenseClaim(user, params.id);
    else if (action === "reimburse") await markReimbursed(user, params.id);
    else return decideExpenseClaim(user, params.id, action === "approve" ? "APPROVED" : "REJECTED", note);
    return { ok: true };
}, { feature: "expenses" });
