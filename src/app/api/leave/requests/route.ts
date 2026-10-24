import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { listLeaveRequests } from "@/services/attendance-queries";
import { createLeaveRequest } from "@/services/leave";

export const dynamic = 'force-dynamic';

export const GET = route(async ({ req, user }) => listLeaveRequests(user, new URL(req.url).searchParams.get("userId")));

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
