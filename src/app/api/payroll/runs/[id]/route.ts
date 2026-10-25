import { z } from "zod";
import { PEOPLE_ADMIN_ROLES, parseBody, route } from "@/lib/api";
import { deleteDraftRun, finalizePayroll, getPayrollRun, markPayrollPaid } from "@/services/payroll";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ user, params }) => getPayrollRun(user, params.id), { roles: PEOPLE_ADMIN_ROLES, feature: "payroll" });

const schema = z.object({ action: z.enum(["finalize", "pay"]) });

/** finalize: lock and publish payslips. pay: record the bank transfer. */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
    const { action } = await parseBody(req, schema);
    return action === "finalize" ? finalizePayroll(user, params.id) : markPayrollPaid(user, params.id);
}, { roles: PEOPLE_ADMIN_ROLES, feature: "payroll" });

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
    await deleteDraftRun(user, params.id);
    return { ok: true };
}, { roles: PEOPLE_ADMIN_ROLES, feature: "payroll" });
