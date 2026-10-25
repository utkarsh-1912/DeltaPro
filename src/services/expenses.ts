import { prisma } from "@/lib/prisma";
import { audit, notify } from "@/lib/activity";
import { HttpError, assertCanApproveFor, isPeopleAdmin, scopeByUser, type SessionUser } from "@/lib/api";
import { approversFor } from "./shared";

export const EXPENSE_CATEGORIES = ["TRAVEL", "MEALS", "LODGING", "SUPPLIES", "INTERNET", "TRAINING", "OTHER"] as const;
const PEOPLE = { select: { id: true, name: true, email: true, image: true } } as const;

/** Own claims, reports' claims for PMs, everything for HR/ADMIN. ?mine=true limits to own. */
export function listExpenseClaims(actor: SessionUser, opts: { mine?: boolean; status?: string | null }) {
    return prisma.expenseClaim.findMany({
        where: { ...(opts.mine ? { userId: actor.id } : scopeByUser(actor)), ...(opts.status ? { status: opts.status } : {}) },
        include: { user: PEOPLE, approver: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
    });
}

export type ExpenseInput = { title: string; category: string; amount: number; currency?: string; spentOn: string; description?: string | null; receiptId?: string | null };

export async function submitExpenseClaim(actor: SessionUser, input: ExpenseInput) {
    if (!EXPENSE_CATEGORIES.includes(input.category as any)) throw new HttpError(400, `Category must be one of ${EXPENSE_CATEGORIES.join(", ")}.`);
    const spentOn = new Date(input.spentOn);
    if (Number.isNaN(spentOn.getTime()) || spentOn > new Date()) throw new HttpError(400, "The expense date must be today or earlier.");
    if (input.receiptId) {
        const doc = await prisma.document.findUnique({ where: { id: input.receiptId }, select: { userId: true } });
        if (!doc || doc.userId !== actor.id) throw new HttpError(400, "Receipt not found.");
    }
    const claim = await prisma.$transaction(async tx => {
        const created = await tx.expenseClaim.create({
            data: { userId: actor.id, title: input.title, category: input.category, amount: input.amount, currency: input.currency ?? "INR", spentOn, description: input.description ?? null, receiptId: input.receiptId ?? null },
        });
        for (const a of await approversFor(actor.id, tx)) {
            await notify(tx, a.id, "Expense claim", `${actor.name ?? actor.email} claimed ${input.amount.toLocaleString("en-IN")} for ${input.title}.`, "alert");
        }
        return created;
    });
    return claim;
}

export async function decideExpenseClaim(actor: SessionUser, id: string, status: "APPROVED" | "REJECTED", note?: string | null) {
    const claim = await prisma.expenseClaim.findUnique({ where: { id } });
    if (!claim) throw new HttpError(404, "Claim not found.");
    await assertCanApproveFor(actor, claim.userId);
    const changed = await prisma.expenseClaim.updateMany({
        where: { id, status: "SUBMITTED" },
        data: { status, approverId: actor.id, decidedAt: new Date(), decisionNote: note ?? null },
    });
    if (changed.count === 0) throw new HttpError(409, `This claim is already ${claim.status.toLowerCase()}.`);
    await notify(prisma, claim.userId, `Expense ${status.toLowerCase()}`, `${claim.title}: ${status === "APPROVED" ? "it will be paid with the next payroll" : note || "rejected"}.`, status === "APPROVED" ? "success" : "alert");
    await audit(prisma, actor.id, `expense.${status.toLowerCase()}`, "ExpenseClaim", id, { amount: claim.amount });
    return prisma.expenseClaim.findUnique({ where: { id } });
}

export async function cancelExpenseClaim(actor: SessionUser, id: string) {
    const claim = await prisma.expenseClaim.findUnique({ where: { id } });
    if (!claim) throw new HttpError(404, "Claim not found.");
    if (claim.userId !== actor.id && !isPeopleAdmin(actor)) throw new HttpError(403, "You can only cancel your own claims.");
    const changed = await prisma.expenseClaim.updateMany({ where: { id, status: "SUBMITTED" }, data: { status: "CANCELLED" } });
    if (changed.count === 0) throw new HttpError(409, "Only submitted claims can be cancelled.");
}

/** HR marks a claim paid outside payroll (bank transfer, petty cash). */
export async function markReimbursed(actor: SessionUser, id: string) {
    if (!isPeopleAdmin(actor)) throw new HttpError(403, "Only HR or an admin can mark claims reimbursed.");
    const changed = await prisma.expenseClaim.updateMany({ where: { id, status: "APPROVED" }, data: { status: "REIMBURSED", reimbursedAt: new Date() } });
    if (changed.count === 0) throw new HttpError(409, "Only approved claims can be reimbursed.");
    await audit(prisma, actor.id, "expense.reimbursed", "ExpenseClaim", id);
}
