import { z } from "zod";
import { PEOPLE_ADMIN_ROLES, parseBody, route } from "@/lib/api";
import { upsertSalaryStructure } from "@/services/payroll";

export const dynamic = "force-dynamic";

const schema = z.object({
    annualCtc: z.number().positive().max(1_000_000_000),
    basicPercent: z.number().min(10).max(100).optional(),
    hraPercent: z.number().min(0).max(100).optional(),
    pfEnabled: z.boolean().optional(),
    pfCapped: z.boolean().optional(),
    esiEnabled: z.boolean().optional(),
    ptEnabled: z.boolean().optional(),
    taxRegime: z.enum(["NEW", "OLD"]).optional(),
    pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN looks like ABCDE1234F").nullable().optional(),
    uan: z.string().trim().regex(/^\d{12}$/, "UAN has 12 digits").nullable().optional(),
    bankAccount: z.string().trim().regex(/^\d{6,18}$/, "Account number is 6–18 digits").nullable().optional(),
    ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC looks like HDFC0001234").nullable().optional(),
});

export const PUT = route<{ userId: string }>(async ({ req, user, params }) => upsertSalaryStructure(user, params.userId, await parseBody(req, schema)), { roles: PEOPLE_ADMIN_ROLES, feature: "payroll" });
