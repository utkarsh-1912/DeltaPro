import { LeaveStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError, PEOPLE_ADMIN_ROLES, route } from "@/lib/api";
import { audit } from "@/lib/activity";
import { weekdaysBetween } from "@/services/shared";

export const dynamic = "force-dynamic";

const csvCell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Leave days of a request that fall inside [from, to], weekdays only. */
function overlapDays(start: Date, end: Date, from: Date, to: Date, isHalfDay: boolean) {
    const s = start > from ? start : from;
    const e = end < to ? end : to;
    if (e < s) return 0;
    return isHalfDay ? 0.5 : weekdaysBetween(s, e);
}

/**
 * GET /api/payroll/export?month=2026-10 → CSV per active employee:
 * working days, days present, hours, paid leave, unpaid leave, absent, LOP (unpaid + absent).
 * Days after today are not counted as absent.
 */
export const GET = route(async ({ req, user }) => {
    const month = new URL(req.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    if (!m) throw new HttpError(400, "month must look like 2026-10");
    const from = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
    const to = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0));
    const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const countedTo = to < today ? to : today;

    const users = await prisma.user.findMany({
        where: { isActive: true },
        include: {
            profile: true,
            attendanceLogs: { where: { loginTime: { gte: from, lt: new Date(to.getTime() + 86400000) } }, select: { loginTime: true, logoutTime: true } },
            leaveRequests: { where: { status: LeaveStatus.APPROVED, startDate: { lte: to }, endDate: { gte: from } } },
        },
        orderBy: { name: "asc" },
    });

    const workingDays = weekdaysBetween(from, to);
    const elapsedWorkingDays = countedTo >= from ? weekdaysBetween(from, countedTo) : 0;
    const header = ["employee_id", "name", "email", "department", "working_days", "present_days", "hours_worked", "paid_leave_days", "unpaid_leave_days", "absent_days", "lop_days"];
    const rows = users.map(u => {
        const presentDays = new Set(u.attendanceLogs.map(l => l.loginTime.toISOString().slice(0, 10))).size;
        const minutes = u.attendanceLogs.reduce((sum, l) => sum + (l.logoutTime ? (l.logoutTime.getTime() - l.loginTime.getTime()) / 60000 : 0), 0);
        let paid = 0;
        let unpaid = 0;
        let leaveSoFar = 0;
        for (const r of u.leaveRequests) {
            const d = overlapDays(r.startDate, r.endDate, from, to, r.isHalfDay);
            if (r.isPaid) paid += d; else unpaid += d;
            leaveSoFar += overlapDays(r.startDate, r.endDate, from, countedTo, r.isHalfDay);
        }
        const absent = Math.max(0, elapsedWorkingDays - presentDays - leaveSoFar);
        return [u.profile?.employeeId, u.name, u.email, u.profile?.department, workingDays, presentDays, (minutes / 60).toFixed(2), paid, unpaid, absent, unpaid + absent];
    });

    await audit(prisma, user.id, "payroll.exported", "Payroll", month, { employees: rows.length });
    const csv = [header, ...rows].map(r => r.map(csvCell).join(",")).join("\n");
    return new Response(csv, {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="deltapro-payroll-${month}.csv"` },
    });
}, { roles: PEOPLE_ADMIN_ROLES });
