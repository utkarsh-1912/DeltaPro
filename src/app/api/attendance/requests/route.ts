import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, canActOnUser, isManager, parseBody, route, scopeByUser } from "@/lib/api";
import { REGULARIZATION_TYPES, createRegularization, decideRegularization } from "@/services/attendance";

export const dynamic = 'force-dynamic';

export const GET = route(async ({ req, user }) => {
    const userId = new URL(req.url).searchParams.get("userId");
    if (userId && !(await canActOnUser(user, userId))) throw new HttpError(403, "Forbidden");
    return prisma.attendanceRequest.findMany({
        where: userId ? { userId } : scopeByUser(user),
        include: {
            user: { select: { name: true, image: true, role: true } },
            approver: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
    });
});

const createSchema = z.object({
    type: z.enum(REGULARIZATION_TYPES),
    date: z.string(),
    reason: z.string().trim().min(3, "Give a reason for the correction.").max(1000),
});

export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, createSchema);
    return Response.json(await createRegularization(user, body), { status: 201 });
});

const decideSchema = z.object({ id: z.string(), status: z.enum(["APPROVED", "REJECTED"]) });

export const PATCH = route(async ({ req, user }) => {
    if (!isManager(user)) throw new HttpError(403, "Forbidden");
    const { id, status } = await parseBody(req, decideSchema);
    return decideRegularization(user, id, status);
});
