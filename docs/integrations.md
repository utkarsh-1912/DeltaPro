# Integrations

DeltaPro sends domain events to external tools through a transactional outbox, and accepts inbound
webhooks on one URL per integration. Admins manage everything at **/integrations**.

## How it works

1. A service (leave, attendance, rota, tasks, people) changes data and writes an `OutboxEvent` in the
   **same database transaction** (`src/integrations/events.ts`).
2. After the response is sent, `scheduleDispatch()` runs the dispatcher. It claims new events with
   `FOR UPDATE SKIP LOCKED`, creates one `Delivery` per enabled, subscribed integration, and runs them.
3. Failed deliveries retry after 30 s, 2 m, 10 m, 1 h and 6 h, then become `DEAD`. `Retry-After` is honoured.
   4xx responses other than 408/429 are not retried. Admins can replay any delivery from the UI.
4. Inbound calls hit `POST /api/hooks/{integrationId}`: signature check → de-duplication (`InboundEvent`)
   → mapped to commands (`src/integrations/commands.ts`) → the same services the UI uses.
   Changes caused by an integration carry its id as `origin` and are not echoed back to it.

Credentials are AES-256-GCM encrypted in `Integration.credentials` and never sent to the browser.

## Connectors

| Connector | Direction | Setup |
|---|---|---|
| Slack | out + in (Approve/Reject buttons) | Connect with OAuth (`SLACK_CLIENT_ID/SECRET`) or paste a bot token. Scopes: `chat:write chat:write.public im:write users:read users:read.email`. Set the app's Interactivity URL to the integration's webhook URL and paste its signing secret. |
| Microsoft Teams | out | Channel → Workflows → "Post to a channel when a webhook request is received"; paste the URL. |
| Email | out | Resend or SendGrid API key and a from address. Also used for password reset emails. |
| Google Calendar | out | Connect with OAuth (`GOOGLE_OAUTH_CLIENT_ID/SECRET` or the SSO client). Redirect URI: `{APP_URL}/api/oauth/callback`. |
| Outlook / Microsoft 365 | out | Connect with OAuth (`MICROSOFT_OAUTH_*` or the Entra SSO app) with `Calendars.ReadWrite`. Same redirect URI. |
| HRIS (webhook) | in + out | Any HR system: POST `{ event, employee }` with `X-Signature: hex(HMAC-SHA256(body, secret))`. Optional outbound URL for leave and attendance. |
| Zoho People | pull + out | Connect with OAuth (`ZOHO_CLIENT_ID/SECRET`, redirect `{APP_URL}/api/oauth/callback`) or paste a Self Client client ID, secret and refresh token. Pick the data centre. Employees sync every 6 hours; map leave types to Zoho leave type IDs to push approved and cancelled leave; optionally push finished attendance sessions. |
| BambooHR | pull | Subdomain + API key. Synced every 6 hours by the `sync` cron, or with **Sync now**. |
| Jira Cloud | out + in | Site URL, account email, API token, project mapping. Register a Jira webhook (issue updated) at the webhook URL with `?secret=…`. |
| GitHub | in | Repository webhook (pull requests, JSON) with a secret. PRs mentioning `KEY-123` move tasks. |
| Attendance devices | in | Devices or their middleware POST punches with `Authorization: Bearer <token>`. |
| SCIM provisioning | in | Base URL `{APP_URL}/api/scim/v2`, bearer token from the integration. Supports Users list/filter, create, get, PUT, PATCH, DELETE (deactivates). |
| Outbound webhook | out | Any URL. Signed with `X-DeltaPro-Signature: t=…,v1=hex(HMAC-SHA256("t.body"))`. |

## Events

`leave.requested|approved|rejected|cancelled`, `attendance.clocked_in|clocked_out|auto_logged_out`,
`attendance.regularization_requested|regularization_decided`, `rota.published|updated|deleted`,
`task.created|updated|status_changed|commented`, `user.created|updated|deactivated`.

Envelope:

```json
{ "id": "…", "type": "leave.approved", "version": 1, "occurredAt": "2026-10-19T09:12:44Z",
  "actor": { "userId": "…", "role": "PM" }, "subject": { "type": "LeaveRequest", "id": "…" },
  "origin": null, "data": { "request": { … }, "user": { … }, "approver": { … }, "managers": [ … ] } }
```

`id` is stable across retries; use it as an idempotency key.

## Scheduled jobs

Call with `Authorization: Bearer $CRON_SECRET` (Cloud Scheduler → HTTP target):

| Job | Suggested schedule | What it does |
|---|---|---|
| `GET /api/cron/dispatch` | every minute | Fan out new events, retry due deliveries |
| `GET /api/cron/auto-logout` | every 15 minutes | Close sessions open longer than the configured hours |
| `GET /api/cron/sync` | hourly | Run pull syncs that are due |
| `GET /api/cron/cleanup` | daily | Drop finished deliveries and events older than 30 days |
| `GET /api/cron/all` | every minute (simple setups) | auto-logout + dispatch + sync |

## Adding a connector

Implement `Connector` from `src/integrations/types.ts` in `src/integrations/connectors/`, list its
fields, events and optional `handle` / `verify` + `receive` / `pullSync` / `oauth`, and register it in
`src/integrations/registry.ts`. The admin UI renders its form from `fields`.
