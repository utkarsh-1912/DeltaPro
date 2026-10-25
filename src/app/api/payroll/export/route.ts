import { HttpError, PEOPLE_ADMIN_ROLES, route } from "@/lib/api";
import { attendanceSummaryCsv } from "@/services/payroll";

export const dynamic = "force-dynamic";

/**
 * GET /api/payroll/export?month=2026-10 → CSV per active employee for external payroll providers:
 * working days (holidays excluded), days present, hours, paid and unpaid leave, absent and LOP days.
 */
export const GET = route(async ({ req, user }) => {
    const month = new URL(req.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, "month must look like 2026-10");
    const { filename, csv } = await attendanceSummaryCsv(user, month);
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });
}, { roles: PEOPLE_ADMIN_ROLES });
