import { format, parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import { failure, http, networkFailure, readBody, skipped } from "../http";
import type { Connector, ConnectorContext, DeliveryResult, DomainCommand } from "../types";

/** Zoho runs separate data centres; accounts and API hosts share the suffix. */
const DATA_CENTRES = [
    { value: "com", label: "United States (zoho.com)" },
    { value: "in", label: "India (zoho.in)" },
    { value: "eu", label: "Europe (zoho.eu)" },
    { value: "com.au", label: "Australia (zoho.com.au)" },
    { value: "jp", label: "Japan (zoho.jp)" },
    { value: "ca", label: "Canada (zohocloud.ca)" },
    { value: "sa", label: "Saudi Arabia (zoho.sa)" },
];
const SCOPES = "ZOHOPEOPLE.forms.ALL,ZOHOPEOPLE.leave.ALL,ZOHOPEOPLE.attendance.ALL,ZOHOPEOPLE.employee.READ";

const domain = (dc: string | undefined) => (dc === "ca" ? "zohocloud.ca" : `zoho.${dc || "com"}`);
const accountsUrl = (dc?: string) => `https://accounts.${domain(dc)}`;
const peopleUrl = (dc?: string) => `https://people.${domain(dc)}`;
const envClientId = () => process.env.ZOHO_CLIENT_ID;
const envClientSecret = () => process.env.ZOHO_CLIENT_SECRET;

function clientCreds(ctx: ConnectorContext) {
    return {
        clientId: ctx.credentials.clientId || envClientId(),
        clientSecret: ctx.credentials.clientSecret || envClientSecret(),
    };
}

async function accessToken(ctx: ConnectorContext): Promise<string> {
    const c = ctx.credentials;
    if (c.access_token && c.expires_at && c.expires_at * 1000 > Date.now() + 60_000) return c.access_token;
    const { clientId, clientSecret } = clientCreds(ctx);
    if (!c.refresh_token) throw new Error("Zoho People is not connected. Use Connect, or paste a Self Client refresh token.");
    if (!clientId || !clientSecret) throw new Error("Zoho client ID and secret are missing (integration fields or ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET).");
    const res = await http(`${accountsUrl(ctx.integration.config.dataCenter)}/oauth/v2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ refresh_token: c.refresh_token, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" }),
    });
    const data = await readBody(res);
    if (!res.ok || !data?.access_token) throw new Error(`Zoho token refresh failed: ${data?.error ?? res.status}`);
    await ctx.saveCredentials({ access_token: data.access_token, expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in ?? 3600) });
    return data.access_token;
}

async function zoho(ctx: ConnectorContext, path: string, init: RequestInit = {}) {
    return http(`${peopleUrl(ctx.integration.config.dataCenter)}${path}`, {
        ...init,
        headers: { Authorization: `Zoho-oauthtoken ${await accessToken(ctx)}`, ...(init.headers ?? {}) },
    });
}

/** Zoho answers HTTP 200 with { response: { status: 1, errors } } on failure. */
function zohoError(body: any): string | null {
    const r = body?.response ?? body;
    if (r?.status === 1 || r?.errors) return JSON.stringify(r.errors ?? r.message ?? r).slice(0, 500);
    return null;
}

function parseMap(text: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    String(text ?? "").split(/\r?\n|,/).forEach(line => {
        const [k, ...v] = line.split("=");
        if (k?.trim() && v.length) out[k.trim().toUpperCase()] = v.join("=").trim();
    });
    return out;
}

/** Zoho's Employee_ID accepts the work email, which is the identity both systems share. */
async function zohoEmployeeRef(userId: string | undefined, email: string | null | undefined): Promise<string | null> {
    if (email) return email;
    if (!userId) return null;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    return user?.email ?? null;
}

function employeeToCommand(e: any): DomainCommand | null {
    const email = e.EmailID ?? e.Email ?? e["Email ID"];
    if (!email) return null;
    const status = String(e.Employeestatus ?? e.Employee_Status ?? "Active").toLowerCase();
    if (["terminated", "resigned", "inactive", "exited", "deceased"].includes(status)) return { kind: "user.deactivate", email };
    return {
        kind: "user.upsert",
        email,
        name: [e.FirstName, e.LastName].filter(Boolean).join(" ") || e.Name || undefined,
        employeeId: e.EmployeeID ?? e.Employee_ID ?? undefined,
        department: e.Department || undefined,
        designation: e.Designation || undefined,
        phoneNumber: e.Mobile || e.Work_phone || undefined,
        managerEmail: e["Reporting_To.MailID"] ?? e.Reporting_To_MailID ?? undefined,
        active: true,
    };
}

async function pushLeave(event: any, ctx: ConnectorContext): Promise<DeliveryResult> {
    const r = event.data.request;
    const linked = await ctx.links.get("LeaveRequest", r.id);

    if (event.type === "leave.cancelled") {
        if (!linked) return skipped("Leave was never sent to Zoho.");
        const res = await zoho(ctx, `/api/v2/leavetracker/leaves/records/cancel/${linked}`, { method: "PATCH" });
        if (res.status === 404) return { ok: true, note: "Already gone in Zoho." };
        if (!res.ok) return failure(res, "Zoho cancel leave");
        await ctx.links.remove("LeaveRequest", r.id);
        return { ok: true, externalId: linked };
    }

    if (linked) return { ok: true, externalId: linked, note: "Already in Zoho." };
    const leaveTypeId = parseMap(ctx.integration.config.leaveTypeMap)[String(r.type).toUpperCase()];
    if (!leaveTypeId) return skipped(`No Zoho leave type mapped for ${r.type}. Add ${r.type}=<Zoho leave type ID> to the mapping.`);
    const employee = await zohoEmployeeRef(event.data.user?.id, event.data.user?.email);
    if (!employee) return { ok: false, retryable: false, error: "Employee has no email or employee ID." };

    const fmt = (d: string) => format(parseISO(d), "dd-MMM-yyyy");
    const inputData = {
        Employee_ID: employee,
        Leavetype: leaveTypeId,
        From: fmt(r.startDate),
        To: fmt(r.endDate),
        Reasonforleave: r.reason || "Approved in DeltaPro",
        ...(r.isHalfDay ? { days: { [fmt(r.startDate)]: { LeaveCount: 0.5, Session: 1 } } } : {}),
    };
    const res = await zoho(ctx, `/people/api/forms/json/leave/insertRecord?inputData=${encodeURIComponent(JSON.stringify(inputData))}`, { method: "POST" });
    if (!res.ok) return failure(res, "Zoho leave");
    const body = await readBody(res);
    const err = zohoError(body);
    if (err) return { ok: false, retryable: false, error: `Zoho leave: ${err}` };
    const pkId = String(body?.response?.result?.pkId ?? "");
    if (pkId) await ctx.links.set("LeaveRequest", r.id, pkId);
    return { ok: true, externalId: pkId || undefined };
}

async function pushAttendance(event: any, ctx: ConnectorContext): Promise<DeliveryResult> {
    if (!ctx.integration.config.syncAttendance) return skipped("Attendance sync is off.");
    const log = event.data.log;
    if (!log.logoutTime) return skipped("Session still open.");
    const employee = await zohoEmployeeRef(event.data.user?.id, event.data.user?.email);
    if (!employee) return { ok: false, retryable: false, error: "Employee has no email or employee ID." };
    const fmt = (d: string) => format(parseISO(d), "dd/MM/yyyy HH:mm:ss");
    const params = new URLSearchParams({
        dateFormat: "dd/MM/yyyy HH:mm:ss",
        checkIn: fmt(log.loginTime),
        checkOut: fmt(log.logoutTime),
        ...(employee.includes("@") ? { emailId: employee } : { empId: employee }),
    });
    const res = await zoho(ctx, `/people/api/attendance?${params}`, { method: "POST" });
    if (!res.ok) return failure(res, "Zoho attendance");
    const err = zohoError(await readBody(res));
    return err ? { ok: false, retryable: false, error: `Zoho attendance: ${err}` } : { ok: true };
}

export const zohoPeopleConnector: Connector = {
    provider: "zoho_people",
    name: "Zoho People",
    category: "HR & payroll",
    description: "Pull employees, managers and exits from Zoho People; push approved leave and completed attendance sessions back.",
    fields: [
        { key: "dataCenter", label: "Zoho data centre", type: "select", scope: "config", required: true, default: "in", options: DATA_CENTRES },
        {
            key: "leaveTypeMap", label: "Leave type mapping", type: "textarea", scope: "config",
            placeholder: "CASUAL=413124000000645001\nSICK=413124000000645003\nEARNED=413124000000645005",
            help: "DeltaPro type = Zoho leave type ID (Leave Tracker → Settings → Leave Types). Unmapped types are not sent.",
        },
        { key: "syncAttendance", label: "Send completed attendance sessions", type: "boolean", scope: "config", default: false },
        { key: "clientId", label: "Client ID", type: "text", scope: "credentials", help: "Optional. Overrides ZOHO_CLIENT_ID; use with a Self Client from api-console.zoho.com." },
        { key: "clientSecret", label: "Client secret", type: "secret", scope: "credentials" },
        { key: "refresh_token", label: "Refresh token", type: "secret", scope: "credentials", help: `Only for Self Client setups (scopes: ${SCOPES}). Filled automatically when you use Connect.` },
    ],
    supportedEvents: ["leave.approved", "leave.cancelled", "attendance.clocked_out", "attendance.auto_logged_out"],
    defaultEvents: ["leave.approved", "leave.cancelled"],
    oauth: {
        available: () => !!(envClientId() && envClientSecret()),
        authorizeUrl: ({ redirectUri, state, config }) =>
            `${accountsUrl(config.dataCenter)}/oauth/v2/auth?${new URLSearchParams({
                scope: SCOPES, client_id: envClientId()!, response_type: "code", access_type: "offline", prompt: "consent", redirect_uri: redirectUri, state,
            })}`,
        async exchange({ code, redirectUri, config }) {
            const res = await http(`${accountsUrl(config.dataCenter)}/oauth/v2/token`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ code, client_id: envClientId()!, client_secret: envClientSecret()!, redirect_uri: redirectUri, grant_type: "authorization_code" }),
            });
            const data = await readBody(res);
            if (!res.ok || !data?.refresh_token) throw new Error(`Zoho OAuth failed: ${data?.error ?? res.status}`);
            return { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in ?? 3600) };
        },
    },

    async handle(event, ctx) {
        try {
            if (event.type.startsWith("leave.")) return await pushLeave(event, ctx);
            if (event.type.startsWith("attendance.")) return await pushAttendance(event, ctx);
            return skipped("Event not used by Zoho People.");
        } catch (e) {
            return networkFailure(e, "Zoho People");
        }
    },

    async pullSync(ctx) {
        const commands: DomainCommand[] = [];
        const PAGE = 200;
        for (let start = 1; start < 20000; start += PAGE) {
            const res = await zoho(ctx, `/people/api/forms/employee/getRecords?sIndex=${start}&limit=${PAGE}`);
            if (!res.ok) throw new Error(`Zoho employees: HTTP ${res.status}`);
            const body = await readBody(res);
            const err = zohoError(body);
            // Zoho reports "no records" as error code 7024 at the end of the list.
            if (err) {
                if (/7024|no records/i.test(err)) break;
                throw new Error(`Zoho employees: ${err}`);
            }
            const result: any[] = body?.response?.result ?? [];
            for (const row of result) {
                for (const records of Object.values(row) as any[][]) {
                    for (const e of records ?? []) {
                        const cmd = employeeToCommand(e);
                        if (cmd) commands.push(cmd);
                    }
                }
            }
            if (result.length < PAGE) break;
        }
        // Create everyone first so manager emails resolve on the second pass.
        const upserts = commands.filter(c => c.kind === "user.upsert");
        return { commands: [...upserts.map(c => ({ ...c, managerEmail: undefined })), ...commands], note: `${upserts.length} active employees read` };
    },

    async healthCheck(ctx) {
        try {
            const res = await zoho(ctx, `/people/api/forms/employee/getRecords?sIndex=1&limit=1`);
            if (!res.ok) return failure(res, "Zoho People");
            const err = zohoError(await readBody(res));
            return err ? { ok: false, retryable: false, error: `Zoho People: ${err}` } : { ok: true, note: "Connected to Zoho People" };
        } catch (e) {
            return { ok: false, retryable: false, error: e instanceof Error ? e.message : String(e) };
        }
    },
};
