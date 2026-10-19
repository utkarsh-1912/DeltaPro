import { prisma } from "@/lib/prisma";
import { PEOPLE_ADMIN_ROLES, route } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/audit?entityType=LeaveRequest&entityId=…&take=100 */
export const GET = route(async ({ req }) => {
    const p = new URL(req.url).searchParams;
    return prisma.auditLog.findMany({
        where: { ...(p.get("entityType") ? { entityType: p.get("entityType")! } : {}), ...(p.get("entityId") ? { entityId: p.get("entityId")! } : {}) },
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: Math.min(500, Number(p.get("take")) || 100),
    });
}, { roles: PEOPLE_ADMIN_ROLES });
