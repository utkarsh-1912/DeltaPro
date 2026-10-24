import { route } from "@/lib/api";
import { listAuditLog } from "@/services/workspace";

export const dynamic = "force-dynamic";

/** GET /api/audit?entityType=LeaveRequest&entityId=…&take=100 (Enterprise plan). */
export const GET = route(async ({ req }) => {
    const p = new URL(req.url).searchParams;
    return listAuditLog({ entityType: p.get("entityType"), entityId: p.get("entityId"), take: Number(p.get("take")) || 100 });
}, { roles: ["ADMIN", "HR"], feature: "audit" });
