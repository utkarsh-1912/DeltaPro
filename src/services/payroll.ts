import { LeaveStatus, Prisma, Role, type Organization } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit, notify } from "@/lib/activity";
import { HttpError, isPeopleAdmin, type SessionUser } from "@/lib/api";
import { calculatePayslip, monthlyGrossFromCtc } from "./payroll-calc";
import { holidaySet, workingDaysBetween } from "./holidays";
import { ymd } from "./shared";

const PEOPLE = { select: { id: true, name: true, email: true, image: true } } as const;

function monthRange(month: string) {
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    if (!m) throw new HttpError(400, "month must look like 2026-10");
    const year = Number(m[1]);
    const mon = Number(m[2]);
    const from = new Date(Date.UTC(year, mon - 1, 1));
    const to = new Date(Date.UTC(year, mon, 0));
    return { year, mon, from, to, daysInMonth: to.getUTCDate() };
}

const assertPayrollAdmin = (actor: SessionUser) => {
    if (!isPeopleAdmin(actor)) throw new HttpError(403, "Only HR or an admin can manage payroll.");
};

// ---------- Salary structures ----------

export async function listSalaryStructures(actor: SessionUser) {
    assertPayrollAdmin(actor);
    const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, email: true, image: true, profile: { select: { employeeId: true, department: true, designation: true } }, salaryStructure: true },
        orderBy: { name: "asc" },
    });
    return users.map(u => ({ ...u, monthlyGross: u.salaryStructure ? Math.round(monthlyGrossFromCtc(u.salaryStructure).gross) : null }));
}

export type SalaryStructureInput = {
    annualCtc: number; basicPercent?: number; hraPercent?: number; pfEnabled?: boolean; pfCapped?: boolean;
    esiEnabled?: boolean; ptEnabled?: boolean; taxRegime?: "NEW" | "OLD"; pan?: string | null; uan?: string | null;
    bankAccount?: string | null; ifsc?: string | null;
};

export async function upsertSalaryStructure(actor: SessionUser, userId: string, input: SalaryStructureInput) {
    assertPayrollAdmin(actor);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new HttpError(404, "Employee not found.");
    const saved = await prisma.salaryStructure.upsert({ where: { userId }, create: { userId, ...input }, update: { ...input } });
    await audit(prisma, actor.id, "payroll.salary_updated", "SalaryStructure", saved.id, { userId, annualCtc: input.annualCtc });
    return saved;
}

// ---------- Runs ----------

export const listPayrollRuns = async (actor: SessionUser) => {
    assertPayrollAdmin(actor);
    return prisma.payrollRun.findMany({ orderBy: { month: "desc" }, include: { _count: { select: { payslips: true } } } });
};

export async function getPayrollRun(actor: SessionUser, id: string) {
    assertPayrollAdmin(actor);
    const run = await prisma.payrollRun.findUnique({
        where: { id },
        include: { payslips: { include: { user: { select: { ...PEOPLE.select, profile: { select: { employeeId: true, department: true } } } } }, orderBy: { user: { name: "asc" } } } },
    });
    if (!run) throw new HttpError(404, "Payroll run not found.");
    return run;
}

/** Unpaid leave days in the month, plus absent working days when the org bases LOP on attendance. */
async function lopDaysFor(userId: string, from: Date, to: Date, attendanceLop: boolean) {
    const leaves = await prisma.leaveRequest.findMany({ where: { userId, status: LeaveStatus.APPROVED, startDate: { lte: to }, endDate: { gte: from } } });
    let unpaid = 0;
    let leaveSoFar = 0;
    const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const countedTo = to < today ? to : today;
    for (const r of leaves) {
        const s = r.startDate > from ? r.startDate : from;
        const e = r.endDate < to ? r.endDate : to;
        if (e < s) continue;
        const days = r.isHalfDay ? 0.5 : await workingDaysBetween(s, e);
        if (!r.isPaid) unpaid += days;
        const e2 = r.endDate < countedTo ? r.endDate : countedTo;
        if (e2 >= s) leaveSoFar += r.isHalfDay ? 0.5 : await workingDaysBetween(s, e2);
    }
    if (!attendanceLop || countedTo < from) return { lop: unpaid, unpaid, absent: 0 };
    const logs = await prisma.attendanceLog.findMany({ where: { userId, loginTime: { gte: from, lt: new Date(countedTo.getTime() + 86400000) } }, select: { loginTime: true } });
    const present = new Set(logs.map(l => ymd(l.loginTime))).size;
    const absent = Math.max(0, (await workingDaysBetween(from, countedTo)) - present - leaveSoFar);
    return { lop: unpaid + absent, unpaid, absent };
}

/**
 * Builds (or rebuilds) the draft run for a month: one payslip per active employee with a salary
 * structure, prorated for loss-of-pay days, with approved unpaid expense claims reimbursed.
 */
export async function processPayroll(actor: SessionUser, org: Organization, month: string) {
    assertPayrollAdmin(actor);
    const { mon, from, to, daysInMonth } = monthRange(month);
    const existing = await prisma.payrollRun.findFirst({ where: { month } });
    if (existing && existing.status !== "DRAFT") throw new HttpError(409, `Payroll for ${month} is already ${existing.status.toLowerCase()}.`);

    const settings = (org.payrollSettings ?? {}) as { attendanceLop?: boolean };
    const people = await prisma.user.findMany({
        where: { isActive: true, salaryStructure: { isNot: null } },
        include: { salaryStructure: true, profile: { select: { dateOfJoining: true } } },
    });
    if (people.length === 0) throw new HttpError(400, "Nobody has a salary structure yet. Add salaries first.");
    const workingDays = await workingDaysBetween(from, to);

    const slips: Prisma.PayslipCreateManyRunInput[] = [];
    let totalGross = 0, totalNet = 0, totalDeductions = 0, totalEmployer = 0;
    for (const p of people) {
        const s = p.salaryStructure!;
        let { lop } = await lopDaysFor(p.id, from, to, !!settings.attendanceLop);
        // Joined mid-month: days before joining are unpaid.
        const joined = p.profile?.dateOfJoining;
        if (joined && joined > from && joined <= to) lop += (joined.getTime() - from.getTime()) / 86400000;
        lop = Math.min(daysInMonth, Math.round(lop * 2) / 2);

        const claims = await prisma.expenseClaim.findMany({ where: { userId: p.id, status: "APPROVED", payslipId: null, spentOn: { lte: to } }, select: { amount: true } });
        const calc = calculatePayslip(s, { daysInMonth, lopDays: lop, month: mon, ptState: org.ptState, reimbursements: claims.reduce((a, c) => a + c.amount, 0) });
        const employer = calc.employerContributions.reduce((a, c) => a + c.amount, 0);
        totalGross += calc.gross; totalNet += calc.net; totalDeductions += calc.totalDeductions; totalEmployer += employer;
        slips.push({
            organizationId: actor.organizationId,
            userId: p.id,
            month,
            workingDays,
            paidDays: daysInMonth - lop,
            lopDays: lop,
            earnings: calc.earnings,
            deductions: calc.deductions,
            employerContributions: calc.employerContributions,
            gross: calc.gross,
            totalDeductions: calc.totalDeductions,
            reimbursements: calc.reimbursements,
            net: calc.net,
        });
    }
    const totals = { employees: slips.length, gross: totalGross, deductions: totalDeductions, net: totalNet, employerCost: totalGross + totalEmployer };

    const run = await prisma.$transaction(async tx => {
        const r = existing
            ? await tx.payrollRun.update({ where: { id: existing.id }, data: { totals, processedAt: new Date() } })
            : await tx.payrollRun.create({ data: { month, totals, createdById: actor.id } });
        await tx.payslip.deleteMany({ where: { runId: r.id } });
        await tx.payrollRun.update({ where: { id: r.id }, data: { payslips: { createMany: { data: slips } } } });
        return r;
    });
    await audit(prisma, actor.id, "payroll.processed", "PayrollRun", run.id, { month, ...totals });
    return getPayrollRun(actor, run.id);
}

/** Locks the run, publishes payslips to employees and marks included expense claims reimbursed. */
export async function finalizePayroll(actor: SessionUser, id: string) {
    assertPayrollAdmin(actor);
    const run = await prisma.payrollRun.findUnique({ where: { id }, include: { payslips: true } });
    if (!run) throw new HttpError(404, "Payroll run not found.");
    if (run.status !== "DRAFT") throw new HttpError(409, `This run is already ${run.status.toLowerCase()}.`);
    const { to } = monthRange(run.month);
    await prisma.$transaction(async tx => {
        await tx.payrollRun.update({ where: { id }, data: { status: "FINALIZED", finalizedAt: new Date() } });
        await tx.payslip.updateMany({ where: { runId: id }, data: { published: true } });
        for (const slip of run.payslips) {
            if (slip.reimbursements > 0) {
                await tx.expenseClaim.updateMany({
                    where: { userId: slip.userId, status: "APPROVED", payslipId: null, spentOn: { lte: to } },
                    data: { status: "REIMBURSED", payslipId: slip.id, reimbursedAt: new Date() },
                });
            }
            await notify(tx, slip.userId, `Payslip for ${run.month}`, `Your payslip is ready. Net pay ${slip.net.toLocaleString("en-IN")}.`, "success");
        }
    });
    await audit(prisma, actor.id, "payroll.finalized", "PayrollRun", id, { month: run.month });
    return getPayrollRun(actor, id);
}

export async function markPayrollPaid(actor: SessionUser, id: string) {
    assertPayrollAdmin(actor);
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new HttpError(404, "Payroll run not found.");
    if (run.status !== "FINALIZED") throw new HttpError(409, "Finalize the run before marking it paid.");
    await prisma.payrollRun.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
    await audit(prisma, actor.id, "payroll.paid", "PayrollRun", id, { month: run.month });
    return getPayrollRun(actor, id);
}

export async function deleteDraftRun(actor: SessionUser, id: string) {
    assertPayrollAdmin(actor);
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new HttpError(404, "Payroll run not found.");
    if (run.status !== "DRAFT") throw new HttpError(409, "Only draft runs can be deleted.");
    await prisma.payrollRun.delete({ where: { id } });
}

// ---------- Payslips ----------

export const myPayslips = (actor: SessionUser) =>
    prisma.payslip.findMany({ where: { userId: actor.id, published: true }, orderBy: { month: "desc" }, select: { id: true, month: true, gross: true, net: true, totalDeductions: true, reimbursements: true } });

/** Employees see their own published payslips; HR/ADMIN see any. */
export async function getPayslip(actor: SessionUser, org: Organization, id: string) {
    const slip = await prisma.payslip.findUnique({
        where: { id },
        include: { run: { select: { status: true } }, user: { select: { id: true, name: true, email: true, profile: { select: { employeeId: true, department: true, designation: true, dateOfJoining: true } }, salaryStructure: { select: { pan: true, uan: true, bankAccount: true, ifsc: true, taxRegime: true } } } } },
    });
    if (!slip) throw new HttpError(404, "Payslip not found.");
    const own = slip.userId === actor.id;
    if (!isPeopleAdmin(actor) && !(own && slip.published)) throw new HttpError(403, "You can only view your own payslips.");
    const mask = (v?: string | null) => (v ? `••••${v.slice(-4)}` : null);
    return {
        ...slip,
        organization: { name: org.name, currency: org.currency },
        user: { ...slip.user, salaryStructure: slip.user.salaryStructure ? { ...slip.user.salaryStructure, bankAccount: mask(slip.user.salaryStructure.bankAccount), pan: mask(slip.user.salaryStructure.pan) } : null },
    };
}

// ---------- Exports ----------

const csvCell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: unknown[][]) => rows.map(r => r.map(csvCell).join(",")).join("\n");

/** Payroll register for a run: one row per payslip with every component. */
export async function payrollRegisterCsv(actor: SessionUser, id: string) {
    const run = await getPayrollRun(actor, id);
    const amount = (lines: unknown, code: string) => ((lines as { code: string; amount: number }[]).find(l => l.code === code)?.amount ?? 0);
    const header = ["employee_id", "name", "email", "department", "paid_days", "lop_days", "basic", "hra", "special", "gross", "pf", "esi", "pt", "tds", "reimbursements", "net", "employer_epf", "employer_eps", "employer_esi"];
    const rows = run.payslips.map(p => [
        p.user.profile?.employeeId, p.user.name, p.user.email, p.user.profile?.department, p.paidDays, p.lopDays,
        amount(p.earnings, "BASIC"), amount(p.earnings, "HRA"), amount(p.earnings, "SPECIAL"), p.gross,
        amount(p.deductions, "PF"), amount(p.deductions, "ESI"), amount(p.deductions, "PT"), amount(p.deductions, "TDS"),
        p.reimbursements, p.net,
        amount(p.employerContributions, "EPF"), amount(p.employerContributions, "EPS"), amount(p.employerContributions, "ESI_ER"),
    ]);
    return { filename: `deltapro-payroll-register-${run.month}.csv`, csv: toCsv([header, ...rows]) };
}

/** Attendance and leave summary per employee for a month (for external payroll providers). */
export async function attendanceSummaryCsv(actor: SessionUser, month: string) {
    assertPayrollAdmin(actor);
    const { from, to } = monthRange(month);
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
    const workingDays = await workingDaysBetween(from, to);
    const elapsed = countedTo >= from ? await workingDaysBetween(from, countedTo) : 0;
    const overlap = async (s0: Date, e0: Date, a: Date, b: Date, half: boolean) => {
        const s = s0 > a ? s0 : a; const e = e0 < b ? e0 : b;
        return e < s ? 0 : half ? 0.5 : workingDaysBetween(s, e);
    };
    const header = ["employee_id", "name", "email", "department", "working_days", "present_days", "hours_worked", "paid_leave_days", "unpaid_leave_days", "absent_days", "lop_days"];
    const rows: unknown[][] = [];
    for (const u of users) {
        const present = new Set(u.attendanceLogs.map(l => ymd(l.loginTime))).size;
        const minutes = u.attendanceLogs.reduce((sum, l) => sum + (l.logoutTime ? (l.logoutTime.getTime() - l.loginTime.getTime()) / 60000 : 0), 0);
        let paid = 0, unpaid = 0, soFar = 0;
        for (const r of u.leaveRequests) {
            const d = await overlap(r.startDate, r.endDate, from, to, r.isHalfDay);
            if (r.isPaid) paid += d; else unpaid += d;
            soFar += await overlap(r.startDate, r.endDate, from, countedTo, r.isHalfDay);
        }
        const absent = Math.max(0, elapsed - present - soFar);
        rows.push([u.profile?.employeeId, u.name, u.email, u.profile?.department, workingDays, present, (minutes / 60).toFixed(2), paid, unpaid, absent, unpaid + absent]);
    }
    await audit(prisma, actor.id, "payroll.exported", "Payroll", month, { employees: rows.length });
    return { filename: `deltapro-attendance-${month}.csv`, csv: toCsv([header, ...rows]) };
}

export { holidaySet };
export const PAYROLL_ROLES: Role[] = [Role.ADMIN, Role.HR];
