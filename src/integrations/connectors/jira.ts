import { safeEqual } from "../crypto";
import { basicAuth, failure, http, networkFailure, readBody, skipped } from "../http";
import type { Connector, ConnectorContext, DeliveryResult, DomainCommand } from "../types";

type Status = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
const DEFAULT_STATUS_MAP: Record<Status, string> = { TODO: "To Do", IN_PROGRESS: "In Progress", REVIEW: "In Review", DONE: "Done" };

/** Parses "KEY=VALUE" lines. */
function parseMap(text: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    String(text ?? "").split(/\r?\n|,/).forEach(line => {
        const [k, ...v] = line.split("=");
        if (k?.trim() && v.length) out[k.trim()] = v.join("=").trim();
    });
    return out;
}

function statusMap(ctx: ConnectorContext): Record<Status, string> {
    return { ...DEFAULT_STATUS_MAP, ...(parseMap(ctx.integration.config.statusMap) as Partial<Record<Status, string>>) };
}

const adf = (text: string) => ({ type: "doc", version: 1, content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }] });

async function jira(ctx: ConnectorContext, path: string, init: RequestInit = {}) {
    const site = String(ctx.integration.config.siteUrl || "").replace(/\/$/, "");
    return http(`${site}/rest/api/3${path}`, {
        ...init,
        headers: {
            Authorization: basicAuth(ctx.credentials.email, ctx.credentials.apiToken),
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
    });
}

async function transition(ctx: ConnectorContext, issueKey: string, status: Status): Promise<DeliveryResult> {
    const target = statusMap(ctx)[status].toLowerCase();
    const res = await jira(ctx, `/issue/${issueKey}/transitions`);
    if (!res.ok) return failure(res, "Jira transitions");
    const { transitions } = await res.json();
    const t = (transitions as any[]).find(t => t.to?.name?.toLowerCase() === target || t.name?.toLowerCase() === target);
    if (!t) return skipped(`No Jira transition to "${statusMap(ctx)[status]}" from the issue's current status.`);
    const post = await jira(ctx, `/issue/${issueKey}/transitions`, { method: "POST", body: JSON.stringify({ transition: { id: t.id } }) });
    return post.ok ? { ok: true, externalId: issueKey } : failure(post, "Jira transition");
}

export const jiraConnector: Connector = {
    provider: "jira",
    name: "Jira Cloud",
    category: "Developer tools",
    description: "Mirror DeltaPro tasks as Jira issues, keep status and comments in step, and pull Jira status changes back.",
    fields: [
        { key: "siteUrl", label: "Jira site URL", type: "url", scope: "config", required: true, placeholder: "https://yourcompany.atlassian.net" },
        { key: "projectMap", label: "Project mapping", type: "textarea", scope: "config", required: true, placeholder: "DELTA=DP\nOPS=OPS", help: "One DeltaPro project key = Jira project key per line. Unmapped projects are ignored." },
        { key: "issueType", label: "Issue type", type: "text", scope: "config", default: "Task" },
        { key: "statusMap", label: "Status names", type: "textarea", scope: "config", placeholder: "TODO=To Do\nIN_PROGRESS=In Progress\nREVIEW=In Review\nDONE=Done", help: "DeltaPro status = Jira status name. Defaults shown." },
        { key: "email", label: "Atlassian account email", type: "text", scope: "credentials", required: true },
        { key: "apiToken", label: "API token", type: "secret", scope: "credentials", required: true, help: "Create at id.atlassian.com → Security → API tokens." },
        { key: "webhookSecret", label: "Inbound webhook secret", type: "secret", scope: "credentials", help: "Append ?secret=<this> to the webhook URL you register in Jira." },
    ],
    supportedEvents: ["task.created", "task.updated", "task.status_changed", "task.commented"],
    defaultEvents: ["task.created", "task.updated", "task.status_changed", "task.commented"],
    inbound: true,

    async handle(event, ctx) {
        const t = event.data.task;
        const projectKey = parseMap(ctx.integration.config.projectMap)[t.projectKey];
        if (!projectKey) return skipped(`DeltaPro project ${t.projectKey} is not mapped to a Jira project.`);
        try {
            let issueKey = await ctx.links.get("Task", t.id);
            if (!issueKey) {
                const res = await jira(ctx, "/issue", {
                    method: "POST",
                    body: JSON.stringify({
                        fields: {
                            project: { key: projectKey },
                            summary: `[${t.key}] ${t.title}`,
                            description: adf(`${t.description ?? ""}\n\nDeltaPro: ${ctx.baseUrl}/tasks`.trim()),
                            issuetype: { name: ctx.integration.config.issueType || "Task" },
                        },
                    }),
                });
                if (!res.ok) return failure(res, "Jira create issue");
                issueKey = (await res.json()).key as string;
                await ctx.links.set("Task", t.id, issueKey);
                if (t.status !== "TODO") await transition(ctx, issueKey, t.status);
                if (event.type === "task.created") return { ok: true, externalId: issueKey };
            }
            switch (event.type) {
                case "task.status_changed":
                    return transition(ctx, issueKey, t.status);
                case "task.commented": {
                    const author = event.data.comment?.author?.name ?? "DeltaPro";
                    const res = await jira(ctx, `/issue/${issueKey}/comment`, { method: "POST", body: JSON.stringify({ body: adf(`${author}: ${event.data.comment?.body ?? ""}`) }) });
                    return res.ok ? { ok: true, externalId: issueKey } : failure(res, "Jira comment");
                }
                case "task.updated": {
                    const res = await jira(ctx, `/issue/${issueKey}`, { method: "PUT", body: JSON.stringify({ fields: { summary: `[${t.key}] ${t.title}` } }) });
                    return res.ok ? { ok: true, externalId: issueKey } : failure(res, "Jira update");
                }
            }
            return { ok: true, externalId: issueKey };
        } catch (e) {
            return networkFailure(e, "Jira");
        }
    },

    async verify(req, ctx) {
        return safeEqual(req.url.searchParams.get("secret"), ctx.credentials.webhookSecret);
    },

    async receive(req, ctx) {
        const body = JSON.parse(req.rawBody || "{}");
        if (body.webhookEvent !== "jira:issue_updated") return { commands: [] };
        const statusItem = (body.changelog?.items ?? []).find((i: any) => i.field === "status");
        if (!statusItem) return { commands: [] };
        const taskId = await ctx.links.findLocal("Task", body.issue?.key);
        if (!taskId) return { commands: [] };
        const reverse = Object.fromEntries(Object.entries(statusMap(ctx)).map(([k, v]) => [v.toLowerCase(), k])) as Record<string, Status>;
        const status = reverse[String(statusItem.toString).toLowerCase()];
        if (!status) return { commands: [] };
        const commands: DomainCommand[] = [{ kind: "task.set_status", taskId, status, note: `Jira ${body.issue.key}` }];
        return { deliveryId: `${body.issue.key}:${body.timestamp}`, commands };
    },

    async healthCheck(ctx) {
        try {
            const res = await jira(ctx, "/myself");
            if (!res.ok) return failure(res, "Jira");
            const me = await readBody(res);
            return { ok: true, note: `Signed in as ${me.displayName}` };
        } catch (e) {
            return networkFailure(e, "Jira");
        }
    },
};
