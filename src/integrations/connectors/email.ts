import { prisma } from "@/lib/prisma";
import { decryptJson } from "../crypto";
import { describe, type Message } from "../format";
import { failure, http, networkFailure, skipped } from "../http";
import type { Connector, DeliveryResult } from "../types";

type EmailConfig = { provider: "resend" | "sendgrid"; from: string; apiKey: string };
type Email = { to: string[]; subject: string; text: string; html: string };

const escape = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function render(msg: Message): Pick<Email, "subject" | "text" | "html"> {
    const facts = msg.facts.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5b6478">${escape(k)}</td><td style="padding:4px 0">${escape(v || "—")}</td></tr>`).join("");
    return {
        subject: msg.title,
        text: `${msg.title}\n\n${msg.text}\n\n${msg.facts.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${msg.link}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#0d1530">
<h2 style="margin:0 0 8px;font-size:18px">${escape(msg.title)}</h2>
<p style="white-space:pre-line;margin:0 0 12px">${escape(msg.text)}</p>
${facts ? `<table style="font-size:14px;border-collapse:collapse;margin-bottom:16px">${facts}</table>` : ""}
<a href="${msg.link}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none">${msg.approval ? "Review in DeltaPro" : "Open DeltaPro"}</a>
</div>`,
    };
}

async function send(cfg: EmailConfig, email: Email): Promise<DeliveryResult> {
    try {
        if (cfg.provider === "sendgrid") {
            const res = await http("https://api.sendgrid.com/v3/mail/send", {
                method: "POST",
                headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    personalizations: [{ to: email.to.map(e => ({ email: e })) }],
                    from: { email: cfg.from },
                    subject: email.subject,
                    content: [{ type: "text/plain", value: email.text }, { type: "text/html", value: email.html }],
                }),
            });
            return res.ok ? { ok: true } : failure(res, "SendGrid");
        }
        const res = await http("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: cfg.from, to: email.to, subject: email.subject, text: email.text, html: email.html }),
        });
        return res.ok ? { ok: true } : failure(res, "Resend");
    } catch (e) {
        return networkFailure(e, "Email");
    }
}

/**
 * Send a transactional email (password reset, invites) through the first enabled email
 * integration, or RESEND_API_KEY + EMAIL_FROM from the environment. Logs in development.
 */
export async function sendDirectEmail(to: string, subject: string, text: string, link?: string): Promise<boolean> {
    const integration = await prisma.integration.findFirst({ where: { provider: "email", enabled: true }, orderBy: { createdAt: "asc" } });
    let cfg: EmailConfig | null = null;
    if (integration) {
        const c = integration.config as any;
        cfg = { provider: c.provider ?? "resend", from: c.from, apiKey: decryptJson(integration.credentials).apiKey };
    } else if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
        cfg = { provider: "resend", from: process.env.EMAIL_FROM, apiKey: process.env.RESEND_API_KEY };
    }
    const content = render({ title: subject, text, link: link ?? "", facts: [], recipients: [to] });
    if (!cfg?.apiKey || !cfg.from) {
        console.info(`[email:dev] To ${to}: ${subject}\n${text}${link ? `\n${link}` : ""}`);
        return false;
    }
    const result = await send(cfg, { to: [to], ...content });
    if (!result.ok) console.error("[email] send failed", result.error);
    return result.ok;
}

export const emailConnector: Connector = {
    provider: "email",
    name: "Email",
    category: "Messaging",
    description: "Email approvers, requesters and assignees through Resend or SendGrid. Also used for password reset emails.",
    fields: [
        { key: "provider", label: "Provider", type: "select", scope: "config", required: true, default: "resend", options: [{ value: "resend", label: "Resend" }, { value: "sendgrid", label: "SendGrid" }] },
        { key: "from", label: "From address", type: "text", scope: "config", required: true, placeholder: "DeltaPro <noreply@yourcompany.com>" },
        { key: "extraRecipients", label: "Always copy", type: "text", scope: "config", placeholder: "hr@yourcompany.com", help: "Comma-separated addresses that receive every subscribed event." },
        { key: "apiKey", label: "API key", type: "secret", scope: "credentials", required: true },
    ],
    supportedEvents: "*",
    defaultEvents: [
        "leave.requested", "leave.approved", "leave.rejected", "leave.cancelled",
        "attendance.auto_logged_out", "attendance.regularization_requested", "attendance.regularization_decided",
        "rota.published", "task.created", "task.commented", "user.created",
    ],
    async handle(event, ctx) {
        const msg = describe(event, ctx.baseUrl);
        const extra = String(ctx.integration.config.extraRecipients || "").split(",").map(s => s.trim()).filter(Boolean);
        const to = Array.from(new Set([...msg.recipients, ...extra]));
        if (to.length === 0) return skipped("No recipients for this event.");
        return send({ provider: ctx.integration.config.provider, from: ctx.integration.config.from, apiKey: ctx.credentials.apiKey }, { to, ...render(msg) });
    },
};
