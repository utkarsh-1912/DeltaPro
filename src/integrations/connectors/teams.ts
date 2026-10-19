import { describe } from "../format";
import { failure, http, networkFailure } from "../http";
import type { Connector } from "../types";

export const teamsConnector: Connector = {
    provider: "teams",
    name: "Microsoft Teams",
    category: "Messaging",
    description: "Post Adaptive Cards to a Teams channel through a Workflows (Power Automate) webhook.",
    fields: [
        {
            key: "webhookUrl", label: "Workflow webhook URL", type: "secret", scope: "credentials", required: true,
            help: "In Teams: channel → Workflows → \"Post to a channel when a webhook request is received\", then paste the URL.",
        },
    ],
    supportedEvents: "*",
    defaultEvents: ["leave.requested", "leave.approved", "attendance.regularization_requested", "rota.published", "task.created"],
    async handle(event, ctx) {
        const msg = describe(event, ctx.baseUrl);
        const card = {
            type: "AdaptiveCard",
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            version: "1.4",
            body: [
                { type: "TextBlock", text: msg.title, weight: "Bolder", size: "Medium", wrap: true },
                { type: "TextBlock", text: msg.text, wrap: true },
                ...(msg.facts.length ? [{ type: "FactSet", facts: msg.facts.map(([title, value]) => ({ title, value: value || "—" })) }] : []),
            ],
            actions: [{ type: "Action.OpenUrl", title: msg.approval ? "Review in DeltaPro" : "Open DeltaPro", url: msg.link }],
        };
        try {
            const res = await http(ctx.credentials.webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "message", attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content: card }] }),
            });
            return res.ok ? { ok: true } : failure(res, "Teams");
        } catch (e) {
            return networkFailure(e, "Teams");
        }
    },
};
