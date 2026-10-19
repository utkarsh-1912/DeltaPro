import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Latest deliveries for one integration, newest first. ?status=FAILED,DEAD to filter. */
export const GET = route<{ id: string }>(async ({ req, params }) => {
    const status = new URL(req.url).searchParams.get("status");
    return prisma.delivery.findMany({
        where: { integrationId: params.id, ...(status ? { status: { in: status.split(",") } } : {}) },
        include: { event: { select: { id: true, type: true, createdAt: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
    });
}, { roles: [Role.ADMIN] });
