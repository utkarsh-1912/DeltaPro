import { failure, http, networkFailure, readBody } from "../http";
import type { Connector, ConnectorContext } from "../types";
import { applyPlan, planCalendar, timedEnd, type CalendarItem } from "./calendar-common";

const clientId = () => process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
const clientSecret = () => process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;
const TOKEN_URL = "https://oauth2.googleapis.com/token";

async function accessToken(ctx: ConnectorContext): Promise<string> {
    const c = ctx.credentials;
    if (c.access_token && c.expires_at && c.expires_at * 1000 > Date.now() + 60_000) return c.access_token;
    if (!c.refresh_token) throw new Error("Google Calendar is not connected. Use Connect on the integration.");
    const res = await http(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId()!, client_secret: clientSecret()!, refresh_token: c.refresh_token, grant_type: "refresh_token" }),
    });
    const data = await readBody(res);
    if (!res.ok) throw new Error(`Google token refresh failed: ${data?.error_description ?? data?.error ?? res.status}`);
    await ctx.saveCredentials({ access_token: data.access_token, expires_at: Math.floor(Date.now() / 1000) + data.expires_in });
    return data.access_token;
}

function toGoogle(item: CalendarItem, tz: string) {
    const base: any = {
        summary: item.summary,
        description: item.description,
        attendees: item.attendees.map(email => ({ email })),
        extendedProperties: { private: { deltapro: `${item.localType}:${item.localId}` } },
    };
    if (item.allDay) return { ...base, start: { date: item.startDate }, end: { date: item.endDate } };
    const end = timedEnd(item);
    return {
        ...base,
        start: { dateTime: `${item.startDate}T${item.startTime}:00`, timeZone: tz },
        end: { dateTime: `${end.date}T${end.time}:00`, timeZone: tz },
        recurrence: item.repeatUntil ? [`RRULE:FREQ=DAILY;UNTIL=${item.repeatUntil.replace(/-/g, "")}T235959Z`] : undefined,
    };
}

export const googleCalendarConnector: Connector = {
    provider: "google_calendar",
    name: "Google Calendar",
    category: "Calendar",
    description: "Add approved leave and published shifts to a shared Google calendar; remove them on cancellation.",
    fields: [
        { key: "calendarId", label: "Calendar ID", type: "text", scope: "config", default: "primary", help: "Use a shared team calendar's ID, or primary." },
        { key: "timeZone", label: "Time zone", type: "text", scope: "config", default: "Asia/Kolkata", placeholder: "Asia/Kolkata" },
        { key: "syncLeave", label: "Sync approved leave", type: "boolean", scope: "config", default: true },
        { key: "syncShifts", label: "Sync rota shifts", type: "boolean", scope: "config", default: true },
        { key: "inviteAttendees", label: "Invite the employee to each event", type: "boolean", scope: "config", default: false },
    ],
    supportedEvents: ["leave.approved", "leave.cancelled", "rota.published", "rota.updated", "rota.deleted"],
    defaultEvents: ["leave.approved", "leave.cancelled", "rota.published", "rota.updated", "rota.deleted"],
    oauth: {
        available: () => !!(clientId() && clientSecret()),
        authorizeUrl: ({ redirectUri, state }) =>
            `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
                client_id: clientId()!,
                redirect_uri: redirectUri,
                response_type: "code",
                scope: "https://www.googleapis.com/auth/calendar.events",
                access_type: "offline",
                prompt: "consent",
                state,
            })}`,
        async exchange({ code, redirectUri }) {
            const res = await http(TOKEN_URL, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ code, client_id: clientId()!, client_secret: clientSecret()!, redirect_uri: redirectUri, grant_type: "authorization_code" }),
            });
            const data = await readBody(res);
            if (!res.ok) throw new Error(`Google OAuth failed: ${data?.error_description ?? data?.error ?? res.status}`);
            return { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Math.floor(Date.now() / 1000) + data.expires_in };
        },
    },
    async handle(event, ctx) {
        const plan = planCalendar(event, ctx.integration.config);
        const calendarId = encodeURIComponent(ctx.integration.config.calendarId || "primary");
        const tz = ctx.integration.config.timeZone || "UTC";
        try {
            const token = await accessToken(ctx);
            const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
            const sendUpdates = ctx.integration.config.inviteAttendees ? "all" : "none";
            return await applyPlan(plan, ctx, {
                async create(item) {
                    const res = await http(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?sendUpdates=${sendUpdates}`, {
                        method: "POST", headers, body: JSON.stringify(toGoogle(item, tz)),
                    });
                    if (!res.ok) return { ok: false, result: await failure(res, "Google Calendar") };
                    return { ok: true, id: (await res.json()).id };
                },
                async remove(externalId) {
                    const res = await http(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${externalId}?sendUpdates=${sendUpdates}`, { method: "DELETE", headers });
                    return res.ok || res.status === 404 || res.status === 410 ? { ok: true } : failure(res, "Google Calendar");
                },
            });
        } catch (e) {
            return networkFailure(e, "Google Calendar");
        }
    },
    async healthCheck(ctx) {
        try {
            const token = await accessToken(ctx);
            const calendarId = encodeURIComponent(ctx.integration.config.calendarId || "primary");
            const res = await http(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) return failure(res, "Google Calendar");
            return { ok: true, note: `Calendar: ${(await res.json()).summary}` };
        } catch (e) {
            return { ok: false, retryable: false, error: e instanceof Error ? e.message : String(e) };
        }
    },
};
