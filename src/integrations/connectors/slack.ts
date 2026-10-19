import { hmacHex, safeEqual } from "../crypto";
import { describe, type Message } from "../format";
import { failure, http, networkFailure, readBody, skipped } from "../http";
import type { Connector, ConnectorContext, DeliveryResult, DomainCommand } from "../types";

const SLACK_API = "https://slack.com/api";
const SCOPES = "chat:write,chat:write.public,im:write,users:read,users:read.email";

async function slack(ctx: ConnectorContext, method: string, body: Record<string, unknown>) {
    const res = await http(`${SLACK_API}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${ctx.credentials.botToken}` },
        body: JSON.stringify(body),
    });
    const data = await readBody(res);
    return { res, data };
}

function blocks(msg: Message) {
    const out: any[] = [
        { type: "header", text: { type: "plain_text", text: msg.title.slice(0, 150) } },
        { type: "section", text: { type: "mrkdwn", text: msg.text.slice(0, 2900) || " " } },
    ];
    if (msg.facts.length) {
        out.push({ type: "section", fields: msg.facts.slice(0, 10).map(([k, v]) => ({ type: "mrkdwn", text: `*${k}*\n${v || "—"}` })) });
    }
    const elements: any[] = [];
    if (msg.approval) {
        elements.push(
            { type: "button", style: "primary", text: { type: "plain_text", text: "Approve" }, action_id: `${msg.approval.kind}_approve`, value: msg.approval.requestId },
            { type: "button", style: "danger", text: { type: "plain_text", text: "Reject" }, action_id: `${msg.approval.kind}_reject`, value: msg.approval.requestId },
        );
    }
    elements.push({ type: "button", text: { type: "plain_text", text: "Open DeltaPro" }, url: msg.link, action_id: "open_link" });
    out.push({ type: "actions", elements });
    return out;
}

async function post(ctx: ConnectorContext, channel: string, msg: Message): Promise<DeliveryResult> {
    const { res, data } = await slack(ctx, "chat.postMessage", { channel, text: `${msg.title}: ${msg.text}`, blocks: blocks(msg) });
    if (!res.ok) return failure(res, "Slack");
    if (!data?.ok) {
        const retryable = data?.error === "ratelimited" || data?.error === "internal_error";
        return { ok: false, retryable, error: `Slack: ${data?.error ?? "unknown error"}` };
    }
    return { ok: true, externalId: data.ts };
}

export const slackConnector: Connector = {
    provider: "slack",
    name: "Slack",
    category: "Messaging",
    description: "Post updates to a channel, DM the people involved, and approve leave or attendance corrections with buttons.",
    fields: [
        { key: "channelId", label: "Channel ID", type: "text", scope: "config", placeholder: "C0123456789", help: "Leave empty to send direct messages only." },
        { key: "dmPeople", label: "Direct-message the people involved", type: "boolean", scope: "config", default: true },
        { key: "botToken", label: "Bot token", type: "secret", scope: "credentials", placeholder: "xoxb-…", help: "Filled automatically when you connect with Slack OAuth." },
        { key: "signingSecret", label: "Signing secret", type: "secret", scope: "credentials", help: "Required for Approve / Reject buttons. Set the app's Interactivity URL to this integration's webhook URL." },
    ],
    supportedEvents: "*",
    defaultEvents: [
        "leave.requested", "leave.approved", "leave.rejected",
        "attendance.auto_logged_out", "attendance.regularization_requested", "attendance.regularization_decided",
        "rota.published", "task.created", "task.status_changed",
    ],
    inbound: true,
    oauth: {
        available: () => !!(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET),
        authorizeUrl: ({ redirectUri, state }) =>
            `https://slack.com/oauth/v2/authorize?${new URLSearchParams({ client_id: process.env.SLACK_CLIENT_ID!, scope: SCOPES, redirect_uri: redirectUri, state })}`,
        async exchange({ code, redirectUri }) {
            const res = await http(`${SLACK_API}/oauth.v2.access`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ code, redirect_uri: redirectUri, client_id: process.env.SLACK_CLIENT_ID!, client_secret: process.env.SLACK_CLIENT_SECRET! }),
            });
            const data = await readBody(res);
            if (!data?.ok) throw new Error(`Slack OAuth failed: ${data?.error ?? res.status}`);
            return { botToken: data.access_token, teamId: data.team?.id, teamName: data.team?.name };
        },
    },

    async handle(event, ctx) {
        if (!ctx.credentials.botToken) return { ok: false, retryable: false, error: "Slack: bot token missing. Connect Slack first." };
        const msg = describe(event, ctx.baseUrl);
        const results: DeliveryResult[] = [];
        try {
            if (ctx.integration.config.channelId) {
                // Approval buttons belong in DMs to approvers; the channel gets an informational copy.
                results.push(await post(ctx, ctx.integration.config.channelId, { ...msg, approval: undefined }));
            }
            if (ctx.integration.config.dmPeople !== false) {
                for (const email of msg.recipients) {
                    const { data } = await slack(ctx, "users.lookupByEmail", { email });
                    if (!data?.ok) continue; // person not in this workspace
                    results.push(await post(ctx, data.user.id, msg));
                }
            }
        } catch (e) {
            return networkFailure(e, "Slack");
        }
        if (results.length === 0) return skipped("No channel configured and no recipients found in Slack.");
        return results.find(r => !r.ok) ?? results[0];
    },

    async verify(req, ctx) {
        const ts = req.headers.get("x-slack-request-timestamp");
        const sig = req.headers.get("x-slack-signature");
        if (!ts || !sig || !ctx.credentials.signingSecret) return false;
        if (Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) return false;
        return safeEqual(sig, `v0=${hmacHex(ctx.credentials.signingSecret, `v0:${ts}:${req.rawBody}`)}`);
    },

    async receive(req, ctx) {
        const form = new URLSearchParams(req.rawBody);
        if (form.get("ssl_check")) return { commands: [], response: new Response("ok") };
        const payload = JSON.parse(form.get("payload") || "{}");
        if (payload.type !== "block_actions") return { commands: [], response: new Response("ok") };

        const action = payload.actions?.[0];
        const match = /^(leave|regularization)_(approve|reject)$/.exec(action?.action_id ?? "");
        if (!match) return { commands: [], response: new Response("ok") };

        const { data: info } = await slack(ctx, "users.info", { user: payload.user?.id });
        const actorEmail: string | undefined = info?.user?.profile?.email;
        if (!actorEmail) return { commands: [], response: Response.json({ text: "DeltaPro could not read your Slack email. Approve in DeltaPro instead.", response_type: "ephemeral" }) };

        const status = match[2] === "approve" ? "APPROVED" : "REJECTED";
        const command: DomainCommand = match[1] === "leave"
            ? { kind: "leave.decide", requestId: action.value, status, actorEmail }
            : { kind: "regularization.decide", requestId: action.value, status, actorEmail };

        return {
            deliveryId: `${payload.container?.message_ts ?? ""}:${action.action_ts}`,
            commands: [command],
            async onResult(results) {
                const r = results[0];
                if (payload.response_url) {
                    await http(payload.response_url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            replace_original: false,
                            response_type: "ephemeral",
                            text: r?.ok ? `${status === "APPROVED" ? "Approved" : "Rejected"}. ${r.message}` : `Not changed: ${r?.message ?? "unknown error"}`,
                        }),
                    }).catch(() => undefined);
                }
                return new Response("");
            },
        };
    },

    async healthCheck(ctx) {
        if (!ctx.credentials.botToken) return { ok: false, retryable: false, error: "Bot token missing" };
        const { data } = await slack(ctx, "auth.test", {});
        return data?.ok ? { ok: true, note: `Connected to ${data.team} as ${data.user}` } : { ok: false, retryable: false, error: `Slack: ${data?.error}` };
    },
};
