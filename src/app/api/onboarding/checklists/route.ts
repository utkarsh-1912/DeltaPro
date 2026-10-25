import { z } from "zod";
import { PEOPLE_ADMIN_ROLES, parseBody, route } from "@/lib/api";
import { listChecklists, startChecklist } from "@/services/onboarding";

export const dynamic = "force-dynamic";

export const GET = route(async ({ req, user }) => listChecklists(user, { status: new URL(req.url).searchParams.get("status") }), { feature: "onboarding" });

const schema = z.object({ userId: z.string(), kind: z.enum(["ONBOARDING", "OFFBOARDING"]), templateId: z.string().nullable().optional(), startDate: z.string() });

export const POST = route(async ({ req, user }) => Response.json(await startChecklist(user, await parseBody(req, schema)), { status: 201 }), { roles: PEOPLE_ADMIN_ROLES, feature: "onboarding" });
