import { z } from "zod";
import { Plan, Role } from "@prisma/client";
import { parseBody, route } from "@/lib/api";
import { organizationOverview, updateOrganization } from "@/services/organizations";

export const dynamic = "force-dynamic";

/** Current organization, plan, seat usage and the plan catalogue. */
export const GET = route(async ({ org }) => organizationOverview(org));

const schema = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    domain: z.string().trim().toLowerCase().max(100).nullable().optional(),
    allowDomainJoin: z.boolean().optional(),
    ptState: z.string().trim().toUpperCase().max(3).nullable().optional(),
    timezone: z.string().max(60).optional(),
    currency: z.string().length(3).optional(),
    plan: z.nativeEnum(Plan).optional(),
    attendanceLop: z.boolean().optional(),
});

export const PATCH = route(async ({ req, user, org }) => {
    const { attendanceLop, ...patch } = await parseBody(req, schema);
    const payrollSettings = attendanceLop === undefined ? undefined : { ...((org.payrollSettings as object) ?? {}), attendanceLop };
    const updated = await updateOrganization(user, org.id, { ...patch, ...(payrollSettings ? { payrollSettings } : {}) });
    return organizationOverview(updated);
}, { roles: [Role.ADMIN] });
