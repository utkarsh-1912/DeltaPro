import { z } from "zod";
import { PEOPLE_ADMIN_ROLES, parseBody, route } from "@/lib/api";
import { listPayrollRuns, processPayroll } from "@/services/payroll";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const GET = route(async ({ user }) => listPayrollRuns(user), { roles: PEOPLE_ADMIN_ROLES, feature: "payroll" });

const schema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) });

/** Builds or rebuilds the draft run for a month. */
export const POST = route(async ({ req, user, org }) => processPayroll(user, org, (await parseBody(req, schema)).month), { roles: PEOPLE_ADMIN_ROLES, feature: "payroll" });
