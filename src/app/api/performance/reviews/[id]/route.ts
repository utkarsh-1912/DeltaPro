import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { submitReview } from "@/services/performance";

export const dynamic = "force-dynamic";

const schema = z.object({ rating: z.number().int().min(1).max(5), answers: z.record(z.string().max(5000)), summary: z.string().max(2000).nullable().optional() });

export const POST = route<{ id: string }>(async ({ req, user, params }) => submitReview(user, params.id, await parseBody(req, schema)), { feature: "performance" });
