import { hmacHex, safeEqual } from "../crypto";
import type { Connector, DomainCommand } from "../types";

const TASK_KEY = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/g;

export const githubConnector: Connector = {
    provider: "github",
    name: "GitHub",
    category: "Developer tools",
    description: "Move tasks when pull requests mention their key (e.g. DELTA-12): opened → Review, merged → Done.",
    fields: [
        { key: "openedStatus", label: "Status when a PR opens", type: "select", scope: "config", default: "REVIEW", options: [{ value: "IN_PROGRESS", label: "In progress" }, { value: "REVIEW", label: "Review" }] },
        { key: "mergedStatus", label: "Status when a PR merges", type: "select", scope: "config", default: "DONE", options: [{ value: "REVIEW", label: "Review" }, { value: "DONE", label: "Done" }] },
        { key: "webhookSecret", label: "Webhook secret", type: "secret", scope: "credentials", required: true, help: "Repository → Settings → Webhooks. Content type application/json, event: Pull requests." },
    ],
    supportedEvents: [],
    defaultEvents: [],
    inbound: true,

    async verify(req, ctx) {
        const sig = req.headers.get("x-hub-signature-256");
        return safeEqual(sig, `sha256=${hmacHex(ctx.credentials.webhookSecret || "", req.rawBody)}`);
    },

    async receive(req, ctx) {
        const event = req.headers.get("x-github-event");
        const deliveryId = req.headers.get("x-github-delivery") ?? undefined;
        if (event === "ping") return { deliveryId, commands: [], response: Response.json({ ok: true, pong: true }) };
        if (event !== "pull_request") return { deliveryId, commands: [] };

        const body = JSON.parse(req.rawBody);
        const pr = body.pull_request;
        const text = `${pr?.title ?? ""} ${pr?.head?.ref ?? ""} ${pr?.body ?? ""}`;
        const keys = Array.from(new Set(text.match(TASK_KEY) ?? []));
        if (keys.length === 0) return { deliveryId, commands: [] };

        let status: "IN_PROGRESS" | "REVIEW" | "DONE" | null = null;
        let verb = "";
        if (["opened", "reopened", "ready_for_review"].includes(body.action) && !pr.draft) {
            status = ctx.integration.config.openedStatus || "REVIEW";
            verb = "opened";
        } else if (body.action === "closed" && pr.merged) {
            status = ctx.integration.config.mergedStatus || "DONE";
            verb = "merged";
        }
        if (!status) return { deliveryId, commands: [] };

        const commands: DomainCommand[] = keys.flatMap(taskKey => [
            { kind: "task.set_status" as const, taskKey, status: status!, note: `GitHub PR #${pr.number}` },
            { kind: "task.comment" as const, taskKey, body: `Pull request #${pr.number} ${verb}: ${pr.html_url}` },
        ]);
        return { deliveryId, commands };
    },
};
