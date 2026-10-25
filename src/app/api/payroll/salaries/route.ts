import { PEOPLE_ADMIN_ROLES, route } from "@/lib/api";
import { listSalaryStructures } from "@/services/payroll";

export const dynamic = "force-dynamic";

/** Every active employee with their salary structure (or null). */
export const GET = route(async ({ user }) => listSalaryStructures(user), { roles: PEOPLE_ADMIN_ROLES, feature: "payroll" });
