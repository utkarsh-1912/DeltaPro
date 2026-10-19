import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { decideLeave } from "@/services/leave";

export const dynamic = 'force-dynamic';

const schema = z.object({ status: z.enum(["APPROVED", "REJECTED", "CANCELLED"]) });

/**
 * APPROVED / REJECTED: the employee's manager (PM), HR or an admin; never the requester.
 * CANCELLED: the requester (before the leave starts), HR or an admin. Cancelling approved leave refunds the balance.
 */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
    const { status } = await parseBody(req, schema);
    await decideLeave(user, params.id, status);
    return { message: `Leave request ${status.toLowerCase()} successfully.` };
});
