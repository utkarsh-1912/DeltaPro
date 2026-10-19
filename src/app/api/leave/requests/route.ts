import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, canActOnUser, parseBody, route, scopeByUser } from "@/lib/api";
import { createLeaveRequest } from "@/services/leave";

export const dynamic = 'force-dynamic';

export const GET = route(async ({ req, user }) => {
    const userId = new URL(req.url).searchParams.get("userId");
    if (userId && !(await canActOnUser(user, userId))) throw new HttpError(403, "Forbidden");
    return prisma.leaveRequest.findMany({
        where: userId ? { userId } : scopeByUser(user),
        include: {
            user: { select: { name: true, image: true, role: true } },
            approver: { select: { name: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 500,
    });
});

const schema = z.object({
    type: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    reason: z.string().max(1000).nullable().optional(),
    isHalfDay: z.boolean().optional(),
}).passthrough(); // `duration` from older clients is ignored; the server counts weekdays.

export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, schema);
    return Response.json(await createLeaveRequest(user, body), { status: 201 });
});
