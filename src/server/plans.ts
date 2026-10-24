import type { Plan } from "@prisma/client";

/** Capabilities gated by plan. Everything not listed here is in every plan. */
export const FEATURES = [
    "onboarding",
    "payroll",
    "expenses",
    "assets",
    "performance",
    "integrations.basic",
    "integrations.advanced",
    "audit",
] as const;
export type Feature = (typeof FEATURES)[number];

export type PlanDef = {
    id: Plan;
    name: string;
    seats: number | null;
    price: string;
    blurb: string;
    features: Feature[];
};

export const PLANS: Record<Plan, PlanDef> = {
    STARTER: {
        id: "STARTER",
        name: "Starter",
        seats: 10,
        price: "Free",
        blurb: "Directory, attendance, leave, holidays, rotas, projects, documents and email notifications.",
        features: [],
    },
    GROWTH: {
        id: "GROWTH",
        name: "Growth",
        seats: 200,
        price: "₹120 / employee / month",
        blurb: "Adds payroll and payslips, expenses, assets, onboarding, and Slack, Teams and calendar integrations.",
        features: ["onboarding", "payroll", "expenses", "assets", "integrations.basic"],
    },
    ENTERPRISE: {
        id: "ENTERPRISE",
        name: "Enterprise",
        seats: null,
        price: "Contact sales",
        blurb: "Adds performance and OKRs, HRIS sync, SCIM, Jira and GitHub, attendance devices and the audit log.",
        features: [...FEATURES],
    },
};

export const FEATURE_LABELS: Record<Feature, string> = {
    onboarding: "Onboarding and offboarding",
    payroll: "Payroll and payslips",
    expenses: "Expense claims",
    assets: "Asset management",
    performance: "Performance, OKRs and reviews",
    "integrations.basic": "Slack, Teams, calendars and webhooks",
    "integrations.advanced": "HRIS sync, SCIM, Jira, GitHub and devices",
    audit: "Audit log",
};

export function hasFeature(plan: Plan | null | undefined, feature: Feature): boolean {
    return !!plan && PLANS[plan].features.includes(feature);
}

/** Lowest plan that includes a feature, for upgrade messages. */
export function planFor(feature: Feature): PlanDef {
    return (["STARTER", "GROWTH", "ENTERPRISE"] as Plan[]).map(p => PLANS[p]).find(p => p.features.includes(feature))!;
}

export function seatLimitOf(org: { plan: Plan; seatLimit: number | null }): number | null {
    return org.seatLimit ?? PLANS[org.plan].seats;
}

/** Which plan feature a connector needs. Email stays available on every plan. */
export function connectorFeature(provider: string): Feature | null {
    if (provider === "email") return null;
    if (["slack", "teams", "google_calendar", "outlook", "webhook"].includes(provider)) return "integrations.basic";
    return "integrations.advanced";
}
