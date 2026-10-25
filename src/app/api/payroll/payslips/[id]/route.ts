import { route } from "@/lib/api";
import { getPayslip } from "@/services/payroll";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ user, org, params }) => getPayslip(user, org, params.id), { feature: "payroll" });
