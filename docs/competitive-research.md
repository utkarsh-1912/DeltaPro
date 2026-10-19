# Competitive research (October 2026)

Sources are third-party listings and vendor comparisons; vendors rarely publish full rate cards, so treat prices as indicative.

| Product | Market | Packaging | What the paid tiers add |
|---|---|---|---|
| **Keka** | India SMB / mid-market | Foundation ₹9,999, Strength ₹12,999, Growth ₹15,999 per month for 100 employees, then ₹90–150 per head ([HROne blog](https://content.hrone.cloud/?p=53120), [Toolradar](https://toolradar.com/tools/keka/pricing)) | Foundation already includes core HR, attendance, payroll and expenses; higher tiers add performance and engagement |
| **Zoho People** | Global SMB | Free (5 users), Essential HR, Professional, Premium, Enterprise ≈ $1.25–4.50 per user ([Capterra](https://www.capterra.co.uk/software/110931/zoho-people), [FitSmallBusiness](https://fitsmallbusiness.com/zoho-people-review)) | Professional: time tracking and scheduling. Premium: performance, surveys, analytics. Enterprise: API, case management. People Plus: expenses, recruiting |
| **greytHR** | India payroll-first SMB | Free up to 25 employees ([G2](https://www.g2.com/compare/darwinbox-vs-greythr)) | Payroll with statutory compliance, attendance, leave, performance |
| **Darwinbox** | Enterprise (1,000+) | Quote only | Multi-country payroll, performance, full talent suite ([G2](https://www.g2.com/compare/darwinbox-vs-greythr)) |
| **BambooHR** | US SMB | Core ≈ $10, Pro ≈ $17, Elite ≈ $25 per employee; payroll and benefits are add-ons ([Gusto guide](https://gusto.com/resources/guides/switch-payroll-providers/bamboohr-pricing), [Compono](https://www.compono.com/articles/bamboohr-pricing-guide-2026)) | Pro: performance (360 reviews, 1:1s). Elite: compensation planning and benchmarking |
| **Rippling** | US mid-market | Per-module | HR + IT + finance in one platform, including device (asset) management ([Techjockey](https://www.techjockey.com/us/compare/rippling-vs-hibob)) |
| **HiBob / Personio** | EU mid-market | Quote only | Goals and feedback, compensation, HR helpdesk, analytics ([G2](https://www.g2.com/compare/hibob-hris-vs-personio), [Remotely Talents](https://www.remotelytalents.com/blog/personio-review-features-pricing-competitors)) |

## Patterns worth copying

1. **Multi-tenant SaaS with per-employee tiers.** Every competitor isolates each company and gates modules by plan; a free tier for very small teams is common (Zoho 5, greytHR 25).
2. **Indian buyers expect payroll and expenses in the entry paid tier** (Keka Foundation). Performance management sits one tier up everywhere (Zoho Premium, BambooHR Pro, Keka Strength).
3. **Onboarding, documents and policies are table stakes** in every core tier.
4. **Integrations, API access and provisioning are enterprise levers** (Zoho Enterprise API, Darwinbox).

## Gap analysis for DeltaPro (before this change)

| Area | Competitors | DeltaPro before | Built now |
|---|---|---|---|
| Multi-company tenancy, plans, seat limits | All | Single company | Organizations, Starter / Growth / Enterprise, seat limits, domain auto-join |
| Payroll and payslips (PF, ESI, PT, TDS) | Keka, greytHR, Darwinbox, Zoho (add-on) | CSV export only | Salary structures, monthly runs, payslips, statutory deductions |
| Performance, OKRs, reviews | All except entry tiers | None | Goals with key results, review cycles (self, manager, peer), feedback |
| Onboarding / offboarding | All | None | Checklist templates, per-employee checklists with owners and due dates |
| Documents and policy acknowledgement | All | None | Employee and company documents, acknowledgement tracking |
| Holiday calendar | All | None | Holidays excluded from leave and payroll working days |
| Expenses and reimbursements | Keka, Zoho People Plus, Darwinbox | None | Claims with receipts, manager approval, paid through payroll |
| Assets | Rippling, Keka, Darwinbox | None | Asset register, assignments, return on offboarding |
| Recruitment (ATS) | BambooHR, Keka, Zoho People Plus | None | Not built yet |
| Engagement surveys, helpdesk | Zoho, Personio, HiBob | None | Not built yet |
| Benefits, compensation planning | BambooHR Elite, HiBob | None | Not built yet |

## DeltaPro plans

| | Starter | Growth | Enterprise |
|---|---|---|---|
| Seats | 10 | 200 | Unlimited |
| Directory, attendance, leave, holidays, rotas, projects, tasks, knowledge | ✓ | ✓ | ✓ |
| Documents and policies | ✓ | ✓ | ✓ |
| Email notifications | ✓ | ✓ | ✓ |
| Onboarding and offboarding | | ✓ | ✓ |
| Payroll and payslips, payroll export | | ✓ | ✓ |
| Expenses and assets | | ✓ | ✓ |
| Slack, Teams, calendars, outbound webhooks | | ✓ | ✓ |
| Performance, OKRs and reviews | | | ✓ |
| HRIS sync (Zoho, BambooHR), SCIM, Jira, GitHub, devices | | | ✓ |
| Audit log | | | ✓ |
