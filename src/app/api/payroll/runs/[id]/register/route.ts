import { PEOPLE_ADMIN_ROLES, route } from "@/lib/api";
import { payrollRegisterCsv } from "@/services/payroll";

export const dynamic = "force-dynamic";

/** Payroll register CSV for a run. */
export const GET = route<{ id: string }>(async ({ user, params }) => {
    const { filename, csv } = await payrollRegisterCsv(user, params.id);
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });
}, { roles: PEOPLE_ADMIN_ROLES, feature: "payroll" });
