import { z } from "zod";
import { PEOPLE_ADMIN_ROLES, parseBody, route } from "@/lib/api";
import { addHolidays, listHolidays } from "@/services/holidays";

export const dynamic = "force-dynamic";

export const GET = route(async ({ req }) => listHolidays(Number(new URL(req.url).searchParams.get("year")) || new Date().getFullYear()));

const item = z.object({ date: z.string(), name: z.string().trim().min(1).max(100), optional: z.boolean().optional() });
const schema = z.union([z.object({ holidays: z.array(item).min(1).max(100) }), item]);

/** Add one holiday or a list (e.g. the year's calendar). Same date replaces the name. */
export const POST = route(async ({ req, user }) => {
    const body = await parseBody(req, schema);
    return Response.json(await addHolidays(user, "holidays" in body ? body.holidays : [body]), { status: 201 });
}, { roles: PEOPLE_ADMIN_ROLES });
