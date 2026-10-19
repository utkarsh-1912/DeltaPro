import { hmacHex, safeEqual } from "../crypto";
import { basicAuth, http, readBody } from "../http";
import type { Connector, DomainCommand } from "../types";
import { postSigned } from "./webhook";

function employeeCommand(e: any): DomainCommand | null {
    const email = e?.email ?? e?.workEmail ?? e?.work_email;
    if (!email) return null;
    const status = String(e.status ?? e.employmentStatus ?? "active").toLowerCase();
    if (["terminated", "inactive", "exited", "resigned"].includes(status)) return { kind: "user.deactivate", email };
    return {
        kind: "user.upsert",
        email,
        name: e.name ?? e.displayName ?? ([e.firstName, e.lastName].filter(Boolean).join(" ") || undefined),
        employeeId: e.employeeId ?? e.employee_id ?? e.employeeNumber ?? (e.id != null ? String(e.id) : undefined),
        department: e.department ?? undefined,
        designation: e.designation ?? e.jobTitle ?? e.job_title ?? undefined,
        phoneNumber: e.phoneNumber ?? e.mobilePhone ?? e.workPhone ?? undefined,
        managerEmail: e.managerEmail ?? e.manager_email ?? undefined,
        active: true,
    };
}

/**
 * Generic HRIS connector for systems that can send and receive webhooks
 * (Keka, Darwinbox, Zoho People, HiBob, custom HR apps).
 */
export const hrisWebhookConnector: Connector = {
    provider: "hris_webhook",
    name: "HRIS (webhook)",
    category: "HR & payroll",
    description: "Receive employee joins, changes and exits from any HR system; send approved leave and attendance back.",
    fields: [
        { key: "outboundUrl", label: "Send DeltaPro events to", type: "url", scope: "config", help: "Optional. Your HRIS or middleware endpoint for leave and attendance events." },
        { key: "secret", label: "Shared secret", type: "secret", scope: "credentials", required: true, help: "Inbound: send X-Signature = hex HMAC-SHA256(body). Outbound: we sign with X-DeltaPro-Signature." },
    ],
    supportedEvents: ["leave.approved", "leave.cancelled", "attendance.clocked_out", "attendance.auto_logged_out", "attendance.regularization_decided"],
    defaultEvents: ["leave.approved", "leave.cancelled"],
    inbound: true,
    async handle(event, ctx) {
        if (!ctx.integration.config.outboundUrl) return { ok: true, skipped: true, note: "No outbound URL configured." };
        return postSigned(ctx.integration.config.outboundUrl, ctx.credentials.secret, event, "HRIS");
    },
    async verify(req, ctx) {
        const sig = (req.headers.get("x-signature") || "").replace(/^sha256=/, "");
        return safeEqual(sig, hmacHex(ctx.credentials.secret || "", req.rawBody));
    },
    async receive(req) {
        // Accepts { event, id, employee } or { employees: [...] } or a bare array of employees.
        const body = JSON.parse(req.rawBody || "{}");
        const list: any[] = Array.isArray(body) ? body : body.employees ?? (body.employee ? [body.employee] : []);
        const commands = list.map(e => {
            if (body.event && /terminat|exit|deactivat/i.test(body.event)) {
                const email = e?.email ?? e?.workEmail;
                return email ? ({ kind: "user.deactivate", email } as DomainCommand) : null;
            }
            return employeeCommand(e);
        }).filter((c): c is DomainCommand => !!c);
        return { deliveryId: body.id ?? req.headers.get("x-request-id") ?? undefined, commands };
    },
};

export const bambooHrConnector: Connector = {
    provider: "bamboohr",
    name: "BambooHR",
    category: "HR & payroll",
    description: "Pull the employee directory every sync run: new hires get accounts, profile fields stay current.",
    fields: [
        { key: "subdomain", label: "Company subdomain", type: "text", scope: "config", required: true, placeholder: "yourcompany", help: "From yourcompany.bamboohr.com" },
        { key: "apiKey", label: "API key", type: "secret", scope: "credentials", required: true },
    ],
    supportedEvents: [],
    defaultEvents: [],
    async pullSync(ctx) {
        const url = `https://api.bamboohr.com/api/gateway.php/${encodeURIComponent(ctx.integration.config.subdomain)}/v1/employees/directory`;
        const res = await http(url, { headers: { Accept: "application/json", Authorization: basicAuth(ctx.credentials.apiKey, "x") } });
        if (!res.ok) throw new Error(`BambooHR directory: HTTP ${res.status}`);
        const data = await readBody(res);
        const commands = (data?.employees ?? []).map(employeeCommand).filter((c: DomainCommand | null): c is DomainCommand => !!c);
        return { commands, note: `${commands.length} employees read` };
    },
    async healthCheck(ctx) {
        try {
            const result = await bambooHrConnector.pullSync!(ctx);
            return { ok: true, note: result.note };
        } catch (e) {
            return { ok: false, retryable: false, error: e instanceof Error ? e.message : String(e) };
        }
    },
};
