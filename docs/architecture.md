# DeltaPro architecture

## Tiers

```
Browser (pages, components)      src/app/**/page.tsx, src/components/**
        │  HTTPS JSON only (fetch /api/...)
API tier (controllers)           src/app/api/**/route.ts
        │  parse + validate (zod), authorise (role, plan feature), call one service
Application tier (services)      src/services/**, src/integrations/**
        │  business rules, transactions, events, notifications, audit
Data tier                        src/lib/prisma.ts, src/server/db/tenant.ts
        │  tenant-scoped Prisma client
PostgreSQL (Neon)
```

`scripts/check-layers.mjs` runs before every build and fails it if a page or component imports
server code, or if an API route imports the database client directly.

## Multi-tenancy

- Each customer is an `Organization`. Tenant-owned tables carry `organizationId`.
- `route()` in `src/lib/api.ts` reads the organization from the session, checks it is active, and runs
  the handler inside `runWithTenant(orgId)` (`src/server/context.ts`, AsyncLocalStorage).
- The Prisma extension in `src/server/db/tenant.ts` adds `organizationId` to every query's `where` and
  to every create, so a query cannot return another organization's rows. Nested creates are not
  rewritten; services set `organizationId` on them explicitly.
- Cross-tenant work (event dispatcher, cron fan-out, SCIM token lookup, auth adapter) uses `rootPrisma`
  or `runAsSystem()` explicitly, then enters each organization's context for the actual work.
- Emails are unique across organizations: one login belongs to one company. Sign-up creates an
  organization (the person becomes ADMIN) unless an organization has claimed the email domain and
  allows domain join; SSO sign-ins follow the same rule.

## Plans

Defined in `src/server/plans.ts`. `route(handler, { feature })` returns 402 with
`{ error, details: { feature, plan } }` when the organization's plan lacks the feature; pages show
`UpgradeNotice` from `src/components/use-api.tsx`. Seat limits are checked whenever someone is
created or reactivated. Connectors are gated by `connectorFeature()`, both when created and when the
dispatcher delivers.

| Feature key | Starter | Growth | Enterprise |
|---|---|---|---|
| core HR, attendance, leave, holidays, rota, projects, documents, email | ✓ | ✓ | ✓ |
| `onboarding`, `payroll`, `expenses`, `assets`, `integrations.basic` | | ✓ | ✓ |
| `performance`, `integrations.advanced`, `audit` | | | ✓ |

## Modules added

| Module | Service | API | Page |
|---|---|---|---|
| Organization and plans | `organizations.ts`, `accounts.ts` | `/api/organization`, `/api/auth/register` | `/organization`, `/signup` |
| Holidays | `holidays.ts` (also used by leave and payroll day counts) | `/api/holidays` | `/holidays` |
| Documents and policy acknowledgement | `documents.ts` | `/api/documents` | `/documents` |
| Onboarding and offboarding | `onboarding.ts` | `/api/onboarding/*` | `/onboarding` |
| Expenses | `expenses.ts` | `/api/expenses` | `/expenses` |
| Assets | `assets.ts` | `/api/assets` | `/assets` |
| Payroll (PF, ESI, PT, TDS) | `payroll.ts`, `payroll-calc.ts` (pure) | `/api/payroll/*` | `/payroll`, `/payroll/payslips/[id]` |
| Performance (OKRs, reviews, feedback) | `performance.ts` | `/api/performance/*` | `/performance` |

## Deploying a schema change

1. `npx prisma db push` (or a migration) against the database.
2. First time only: `npm run db:backfill-tenancy` to put existing rows in one organization.
3. Deploy. The build runs `prisma generate` itself, so Vercel always has a typed client.
