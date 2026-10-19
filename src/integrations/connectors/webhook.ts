import { hmacHex } from "../crypto";
import { failure, http, networkFailure } from "../http";
import type { DomainEvent } from "../events";
import type { Connector, DeliveryResult } from "../types";

/** Signature header: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">. */
export function signatureHeader(secret: string, body: string, ts = Math.floor(Date.now() / 1000)) {
    return `t=${ts},v1=${hmacHex(secret, `${ts}.${body}`)}`;
}

export async function postSigned(url: string, secret: string | undefined, event: DomainEvent, label: string): Promise<DeliveryResult> {
    const body = JSON.stringify(event);
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "DeltaPro-Webhooks/1.0",
        "X-DeltaPro-Event": event.type,
        "X-DeltaPro-Delivery": event.id,
    };
    if (secret) headers["X-DeltaPro-Signature"] = signatureHeader(secret, body);
    try {
        const res = await http(url, { method: "POST", headers, body });
        return res.ok ? { ok: true } : failure(res, label);
    } catch (e) {
        return networkFailure(e, label);
    }
}

export const webhookConnector: Connector = {
    provider: "webhook",
    name: "Outbound webhook",
    category: "Platform",
    description: "POST every subscribed event as signed JSON to your own endpoint (Zapier, n8n, internal services).",
    fields: [
        { key: "url", label: "Endpoint URL", type: "url", scope: "config", required: true, placeholder: "https://example.com/hooks/deltapro" },
        { key: "secret", label: "Signing secret", type: "secret", scope: "credentials", help: "Used for the X-DeltaPro-Signature header. Verify t and v1 on your side." },
    ],
    supportedEvents: "*",
    defaultEvents: ["leave.approved", "leave.cancelled", "attendance.auto_logged_out", "rota.published"],
    async handle(event, ctx) {
        return postSigned(ctx.integration.config.url, ctx.credentials.secret, event, "Webhook");
    },
};
