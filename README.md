# DeltaPro - Professional Rota Management

DeltaPro is a workforce platform: shift rotas, geofenced attendance, leave with balances, projects and tasks, a docs wiki, and an employee directory. It is built with Next.js 15, Auth.js, Prisma and PostgreSQL, and connects to Slack, Teams, email, Google and Outlook calendars, HR systems, Jira, GitHub, attendance devices and SCIM identity providers.

## Getting Started

To get started with the application:

1.  Run `npm install` to install the dependencies.
2.  Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `AUTH_SECRET` and `AUTH_ADMIN_EMAILS`.
3.  Apply the schema: `npx prisma db push` (or create a migration with `npx prisma migrate dev`).
4.  Run `npm run dev` and open http://localhost:9002. Sign up with an email listed in `AUTH_ADMIN_EMAILS` to get the first admin.

### Upgrading an existing database

Passwords are now verified. Accounts created before this change have no password: they can use
**Forgot password** (needs an Email integration or `RESEND_API_KEY`; in development the reset link is
printed to the server log), sign in with Google / Microsoft SSO, or an admin can set one with
`PATCH /api/employees/{id}` `{ "password": "…" }`. Set each employee's manager in the directory so
PMs can approve their leave.

### Integrations and scheduled jobs

See [docs/integrations.md](docs/integrations.md) for connector setup, the event contract and the cron
endpoints (`/api/cron/*`, authenticated with `CRON_SECRET`).

## Key Features

-   **Intelligent Rota Generation**: Automatically create fair and balanced shift schedules for configurable periods (1, 2, or 4 weeks).
-   **Team & Shift Management**: Easily manage team members, their fixed assignments, shift timings, staffing requirements, and rotation rules via a central Config Panel.
-   **Dynamic Dashboard**: View the currently active rota, swap shifts between members, and export the schedule as a CSV or PNG image.
-   **Ad-hoc Support Planning**: Assign team members to weekly ad-hoc support duties, log notes, and export the support rota.
-   **Automated Weekend Rota**: View and manage a separate, sequential rota for weekend duties, with its own swap functionality.
-   **Comprehensive Rota Matrix**: Analyze historical assignment data for all members across all rota periods for shifts, ad-hoc duties, and weekend assignments.
-   **Manual Swap History**: Keep track of all manual shift swaps, with a system to "cancel out" historical changes to maintain long-term fairness.
-   **Attendance**: Server-enforced geofence and GPS accuracy, automatic clock-out when leaving the office or after a maximum session length, and manager-approved corrections.
-   **Leave**: Weekday counting, overlap checks, balances reserved by pending requests, atomic approval, refunds on cancellation.
-   **Integrations**: Transactional outbox with retries and a delivery log; Slack approvals, calendar sync, HRIS and SCIM provisioning, Jira and GitHub task sync, device punches, signed webhooks, payroll CSV export.
-   **Security**: Hashed passwords, optional Google / Microsoft Entra SSO, role and manager-scoped access on every API route, audit log for approvals and role changes.
