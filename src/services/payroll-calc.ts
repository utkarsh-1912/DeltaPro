/**
 * Pure Indian payroll arithmetic (FY 2025-26 rules). No I/O, so it is unit-testable.
 * Figures are estimates: no investment declarations, perquisites or arrears.
 */

export type SalaryInput = {
    annualCtc: number;
    basicPercent: number; // of monthly gross
    hraPercent: number;   // of basic
    pfEnabled: boolean;
    pfCapped: boolean;
    esiEnabled: boolean;
    ptEnabled: boolean;
    taxRegime: "NEW" | "OLD" | string;
};

export type Line = { code: string; label: string; amount: number };

export type PayslipCalc = {
    earnings: Line[];
    deductions: Line[];
    employerContributions: Line[];
    gross: number;          // prorated earnings
    totalDeductions: number;
    reimbursements: number;
    net: number;
    monthlyGross: number;   // full-month gross before proration
};

export const PF_WAGE_CEILING = 15000;
export const PF_RATE = 0.12;
export const ESI_GROSS_LIMIT = 21000;
export const ESI_EMPLOYEE_RATE = 0.0075;
export const ESI_EMPLOYER_RATE = 0.0325;

const round = (n: number) => Math.round(n);

/** Professional tax per month by state code, on full-month gross. Unlisted states: none. */
export function professionalTax(state: string | null | undefined, monthlyGross: number, month: number): number {
    switch ((state ?? "").toUpperCase()) {
        case "MH": // Maharashtra: 200 a month, 300 in February
            if (monthlyGross <= 7500) return 0;
            if (monthlyGross <= 10000) return 175;
            return month === 2 ? 300 : 200;
        case "KA": // Karnataka
            return monthlyGross >= 25000 ? 200 : 0;
        case "TG": // Telangana
        case "AP": // Andhra Pradesh
            if (monthlyGross > 20000) return 200;
            if (monthlyGross > 15000) return 150;
            return 0;
        case "GJ": // Gujarat
            return monthlyGross >= 12000 ? 200 : 0;
        case "WB": // West Bengal
            if (monthlyGross > 40000) return 200;
            if (monthlyGross > 25000) return 150;
            if (monthlyGross > 15000) return 130;
            if (monthlyGross > 10000) return 110;
            return 0;
        default:
            return 0;
    }
}

function slabTax(income: number, slabs: [number, number][]): number {
    let tax = 0;
    let lower = 0;
    for (const [upper, rate] of slabs) {
        if (income <= lower) break;
        tax += (Math.min(income, upper) - lower) * rate;
        lower = upper;
    }
    return tax;
}

/** Annual income tax on salary including 4% cess, after the standard deduction and 87A rebate. */
export function annualIncomeTax(annualGross: number, regime: string): number {
    if (regime === "OLD") {
        const taxable = Math.max(0, annualGross - 50000);
        if (taxable <= 500000) return 0;
        const tax = slabTax(taxable, [[250000, 0], [500000, 0.05], [1000000, 0.2], [Infinity, 0.3]]);
        return round(tax * 1.04);
    }
    const taxable = Math.max(0, annualGross - 75000);
    if (taxable <= 1200000) return 0; // Section 87A rebate (FY 2025-26)
    const tax = slabTax(taxable, [[400000, 0], [800000, 0.05], [1200000, 0.1], [1600000, 0.15], [2000000, 0.2], [2400000, 0.25], [Infinity, 0.3]]);
    // Marginal relief: tax may not exceed income above the rebate threshold.
    return round(Math.min(tax, taxable - 1200000) * 1.04);
}

/** Splits CTC into a monthly gross after employer PF and ESI, which are part of CTC. */
export function monthlyGrossFromCtc(s: SalaryInput) {
    const monthlyCtc = s.annualCtc / 12;
    let gross = monthlyCtc;
    let employerPf = 0;
    let employerEsi = 0;
    for (let i = 0; i < 5; i++) {
        const basic = gross * (s.basicPercent / 100);
        employerPf = s.pfEnabled ? PF_RATE * (s.pfCapped ? Math.min(basic, PF_WAGE_CEILING) : basic) : 0;
        employerEsi = s.esiEnabled && gross <= ESI_GROSS_LIMIT ? ESI_EMPLOYER_RATE * gross : 0;
        gross = monthlyCtc - employerPf - employerEsi;
    }
    return { gross, employerPf, employerEsi };
}

export function calculatePayslip(
    s: SalaryInput,
    opts: { daysInMonth: number; lopDays: number; month: number; ptState?: string | null; reimbursements?: number },
): PayslipCalc {
    const { gross: monthlyGross } = monthlyGrossFromCtc(s);
    const payable = Math.max(0, opts.daysInMonth - opts.lopDays);
    const factor = opts.daysInMonth > 0 ? payable / opts.daysInMonth : 0;

    const basicFull = monthlyGross * (s.basicPercent / 100);
    const hraFull = basicFull * (s.hraPercent / 100);
    const specialFull = Math.max(0, monthlyGross - basicFull - hraFull);
    const basic = round(basicFull * factor);
    const hra = round(hraFull * factor);
    const special = round(specialFull * factor);
    const gross = basic + hra + special;

    const pfWage = s.pfCapped ? Math.min(basic, PF_WAGE_CEILING) : basic;
    const employeePf = s.pfEnabled ? round(PF_RATE * pfWage) : 0;
    const esiApplies = s.esiEnabled && monthlyGross <= ESI_GROSS_LIMIT;
    const employeeEsi = esiApplies ? Math.ceil(ESI_EMPLOYEE_RATE * gross) : 0;
    const pt = s.ptEnabled && gross > 0 ? professionalTax(opts.ptState, monthlyGross, opts.month) : 0;
    const tds = gross > 0 ? round(annualIncomeTax(monthlyGross * 12, s.taxRegime) / 12) : 0;

    const deductions: Line[] = [
        { code: "PF", label: "Provident fund (employee)", amount: employeePf },
        { code: "ESI", label: "ESI (employee)", amount: employeeEsi },
        { code: "PT", label: "Professional tax", amount: pt },
        { code: "TDS", label: "Income tax (TDS)", amount: tds },
    ].filter(d => d.amount > 0);
    const totalDeductions = deductions.reduce((a, d) => a + d.amount, 0);
    const reimbursements = round(opts.reimbursements ?? 0);

    // Employer PF split: 8.33% to EPS (on wages up to 15,000), the rest to EPF.
    const employerPfTotal = s.pfEnabled ? round(PF_RATE * pfWage) : 0;
    const eps = s.pfEnabled ? round(0.0833 * Math.min(pfWage, PF_WAGE_CEILING)) : 0;

    return {
        earnings: [
            { code: "BASIC", label: "Basic", amount: basic },
            { code: "HRA", label: "House rent allowance", amount: hra },
            { code: "SPECIAL", label: "Special allowance", amount: special },
        ],
        deductions,
        employerContributions: [
            { code: "EPF", label: "Employer EPF", amount: employerPfTotal - eps },
            { code: "EPS", label: "Employer pension (EPS)", amount: eps },
            { code: "ESI_ER", label: "Employer ESI", amount: esiApplies ? Math.ceil(ESI_EMPLOYER_RATE * gross) : 0 },
        ].filter(c => c.amount > 0),
        gross,
        totalDeductions,
        reimbursements,
        net: gross - totalDeductions + reimbursements,
        monthlyGross: round(monthlyGross),
    };
}
