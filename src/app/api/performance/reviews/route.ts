import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { myReviews, requestPeerReview } from "@/services/performance";

export const dynamic = "force-dynamic";

/** Reviews to write and submitted reviews about the signed-in user. */
export const GET = route(async ({ user }) => myReviews(user), { feature: "performance" });

const schema = z.object({ cycleId: z.string(), revieweeId: z.string().optional(), reviewerId: z.string() });

/** Ask a colleague for a peer review. */
export const POST = route(async ({ req, user }) => {
    const b = await parseBody(req, schema);
    return Response.json(await requestPeerReview(user, b.cycleId, b.revieweeId ?? user.id, b.reviewerId), { status: 201 });
}, { feature: "performance" });
