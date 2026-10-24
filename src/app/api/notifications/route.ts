import { route } from "@/lib/api";
import { clearNotifications, listNotifications, markNotificationsRead } from "@/services/workspace";

export const dynamic = "force-dynamic";

export const GET = route(async ({ user }) => listNotifications(user));

/** Body { id } marks one as read; { markAll: true } marks all. */
export const PATCH = route(async ({ req, user }) => {
    const body = await req.json().catch(() => ({}));
    await markNotificationsRead(user, body.markAll ? null : body.id);
    return { success: true };
});

/** ?id= deletes one; ?all=true deletes all. */
export const DELETE = route(async ({ req, user }) => {
    const p = new URL(req.url).searchParams;
    await clearNotifications(user, p.get("all") === "true" ? null : p.get("id"));
    return { success: true };
});
