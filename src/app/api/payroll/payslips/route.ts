import { route } from "@/lib/api";
import { myPayslips } from "@/services/payroll";

export const dynamic = "force-dynamic";

/** The signed-in employee's published payslips. */
export const GET = route(async ({ user }) => myPayslips(user), { feature: "payroll" });
