import { failure, http, networkFailure, readBody } from "../http";
import type { Connector, ConnectorContext } from "../types";
import { applyPlan, planCalendar, timedEnd, type CalendarItem } from "./calendar-common";

const clientId = () => process.env.MICROSOFT_OAUTH_CLIENT_ID || process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
const clientSecret = () => process.env.MICROSOFT_OAUTH_CLIENT_SECRET || process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
const tenant = () => process.env.MICROSOFT_OAUTH_TENANT || "common";
const SCOPE = "offline_access Calendars.ReadWrite";
const GRAPH = "https://graph.microsoft.com/v1.0";

async function token(ctx: ConnectorContext): Promise<string> {
    const c = ctx.credentials;
    if (c.access_token && c.expires_at && c.expires_at * 1000 > Date.now() + 60_000) return c.access_token;
    if (!c.refresh_token) throw new Error("Outlook is not connected. Use Connect on the integration.");
    const res = await http(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId()!, client_secret: clientSecret()!, refresh_token: c.refresh_token, grant_type: "refresh_token", scope: SCOPE }),
    });
    const data = await readBody(res);
    if (!res.ok) throw new Error(`Microsoft token refresh failed: ${data?.error_description ?? res.status}`);
    await ctx.saveCredentials({
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? c.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    });
    return data.access_token;
}

function eventsPath(config: Record<string, any>) {
    const owner = config.mailbox ? `users/${encodeURIComponent(config.mailbox)}` : "me";
    return config.calendarId ? `${GRAPH}/${owner}/calendars/${encodeURIComponent(config.calendarId)}/events` : `${GRAPH}/${owner}/events`;
}

function toGraph(item: CalendarItem, tz: string) {
    const base: any = {
        subject: item.summary,
        body: { contentType: "text", content: item.description },
        attendees: item.attendees.map(address => ({ emailAddress: { address }, type: "required" })),
        showAs: item.localType === "LeaveRequest" ? "oof" : "busy",
        isReminderOn: false,
    };
    if (item.allDay) {
        return { ...base, isAllDay: true, start: { dateTime: `${item.startDate}T00:00:00`, timeZone: tz }, end: { dateTime: `${item.endDate}T00:00:00`, timeZone: tz } };
    }
    const end = timedEnd(item);
    return {
        ...base,
        start: { dateTime: `${item.startDate}T${item.startTime}:00`, timeZone: tz },
        end: { dateTime: `${end.date}T${end.time}:00`, timeZone: tz },
        recurrence: item.repeatUntil
            ? { pattern: { type: "daily", interval: 1 }, range: { type: "endDate", startDate: item.startDate, endDate: item.repeatUntil } }
            : undefined,
    };
}

export const outlookConnector: Connector = {
    provider: "outlook",
    name: "Outlook / Microsoft 365",
    category: "Calendar",
    description: "Add approved leave (shown as out of office) and rota shifts to an Outlook calendar through Microsoft Graph.",
    fields: [
        { key: "mailbox", label: "Mailbox", type: "text", scope: "config", placeholder: "team-calendar@yourcompany.com", help: "Leave empty to use the connected account's own calendar." },
        { key: "calendarId", label: "Calendar ID", type: "text", scope: "config", help: "Optional. Defaults to the mailbox's main calendar." },
        { key: "timeZone", label: "Time zone", type: "text", scope: "config", default: "India Standard Time", help: "Windows or IANA time zone name." },
        { key: "syncLeave", label: "Sync approved leave", type: "boolean", scope: "config", default: true },
        { key: "syncShifts", label: "Sync rota shifts", type: "boolean", scope: "config", default: true },
        { key: "inviteAttendees", label: "Invite the employee to each event", type: "boolean", scope: "config", default: false },
    ],
    supportedEvents: ["leave.approved", "leave.cancelled", "rota.published", "rota.updated", "rota.deleted"],
    defaultEvents: ["leave.approved", "leave.cancelled", "rota.published", "rota.updated", "rota.deleted"],
    oauth: {
        available: () => !!(clientId() && clientSecret()),
        authorizeUrl: ({ redirectUri, state }) =>
            `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize?${new URLSearchParams({
                client_id: clientId()!, response_type: "code", redirect_uri: redirectUri, response_mode: "query", scope: SCOPE, state, prompt: "consent",
            })}`,
        async exchange({ code, redirectUri }) {
            const res = await http(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ client_id: clientId()!, client_secret: clientSecret()!, code, redirect_uri: redirectUri, grant_type: "authorization_code", scope: SCOPE }),
            });
            const data = await readBody(res);
            if (!res.ok) throw new Error(`Microsoft OAuth failed: ${data?.error_description ?? res.status}`);
            return { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Math.floor(Date.now() / 1000) + data.expires_in };
        },
    },
    async handle(event, ctx) {
        const plan = planCalendar(event, ctx.integration.config);
        const tz = ctx.integration.config.timeZone || "UTC";
        try {
            const headers = { Authorization: `Bearer ${await token(ctx)}`, "Content-Type": "application/json" };
            const path = eventsPath(ctx.integration.config);
            const owner = ctx.integration.config.mailbox ? `users/${encodeURIComponent(ctx.integration.config.mailbox)}` : "me";
            return await applyPlan(plan, ctx, {
                async create(item) {
                    const res = await http(path, { method: "POST", headers, body: JSON.stringify(toGraph(item, tz)) });
                    if (!res.ok) return { ok: false, result: await failure(res, "Outlook") };
                    return { ok: true, id: (await res.json()).id };
                },
                async remove(externalId) {
                    const res = await http(`${GRAPH}/${owner}/events/${externalId}`, { method: "DELETE", headers });
                    return res.ok || res.status === 404 ? { ok: true } : failure(res, "Outlook");
                },
            });
        } catch (e) {
            return networkFailure(e, "Outlook");
        }
    },
    async healthCheck(ctx) {
        try {
            const owner = ctx.integration.config.mailbox ? `users/${encodeURIComponent(ctx.integration.config.mailbox)}` : "me";
            const res = await http(`${GRAPH}/${owner}/calendar`, { headers: { Authorization: `Bearer ${await token(ctx)}` } });
            if (!res.ok) return failure(res, "Outlook");
            return { ok: true, note: `Calendar: ${(await res.json()).name}` };
        } catch (e) {
            return { ok: false, retryable: false, error: e instanceof Error ? e.message : String(e) };
        }
    },
};
