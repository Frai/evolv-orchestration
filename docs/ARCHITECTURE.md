# Architecture

## What this system is

Evolv for oil and gas contractors: a read-mostly layer above a contractor's existing project, accounting, timekeeping, ticketing, fleet and safety systems. This repo is a demo: a fully clickable product backed by a seeded Postgres database. Nothing talks to a real vendor and no model runs at runtime. See `docs/OIL_GAS_PIVOT.md` for the segment, the systems landscape and the build plan this follows.

## Hexagonal architecture across two apps

```
apps/web (Next.js, "use client" pages)
     |  fetch() via src/lib/api-client.ts
     v
apps/api (NestJS)
  Controllers  (HTTP surface, one per port)
     |
  Providers    (adapters: inject a port token, implement a port interface)
     |
  Ports        (interfaces, defined in packages/contracts)
     |
     +--> PgProjectSource, PgBillingSource, ...   (read the seeded Postgres tables; live today)
     +--> real connectors (Vista, Sage, FieldCap, OpenInvoice, ExakTime, ...)   (future: new provider classes)

packages/contracts
  domain types + port interfaces + pure domain functions, shared by both apps
```

## Layer contracts

- **`apps/web`** imports only from `@evolv/contracts` (types and pure functions) and its own `src/lib/api-client.ts`. It never imports a fixture, a provider or anything from `apps/api`. Dashboards load one `Snapshot` per company (`loadSnapshot`) and compute everything else in the browser with the pure functions, so signals, forecasts and the brief inputs are the same code the backend would run.
- **`apps/api`** is the only thing that touches the database, the fixtures or, eventually, a vendor API key. Controllers depend on port interfaces, never concrete providers.
- **`packages/contracts`** stays framework-free: no React, no Nest decorators, no `fetch`.

## Canonical model

Every source dialect translates into one small model (`domain.ts`): `Company`, `Job`, `CostCode` (estimate line, budget at completion), `CostDay` (actual cost, hours, overtime and quantity installed per code per day), `FieldTicket`, `ChangeOrder`, `Invoice`, `Equipment`, `Commitment`, `SafetyEvent`. Connectors are thin translators; no insight code touches a raw vendor schema. Granularity follows one chain: cost code, then job, then portfolio, because that is the path every margin signal drills down through.

## The ports

| Port | Module / controller | Provider | What it stands for |
|---|---|---|---|
| `ProjectSource` | `projects/` at `/projects` | `PgProjectSource` | Accounting job cost, estimate, timekeeping, field progress |
| `BillingSource` | `billing/` at `/billing` | `PgBillingSource` | Field tickets, progress invoices, change orders |
| `ResourceSource` | `resources/` at `/resources` | `PgResourceSource` | Fleet telematics, purchase orders, subcontracts |
| `SafetySource` | `safety/` at `/safety` | `PgSafetySource` | Incidents, near-misses, corrective actions |
| `Narrator` | `narrator/` at `/narrator` | `PgNarrator` | Pre-written daily briefs and Q&A |
| `Notifier` | `notifier/` at `/notifier` | `PgNotifier` | Delivery log |
| `AgentRunner` | `agents/` at `/agents` | `PgAgentRunner` | Agent runs and traces |
| `ApprovalQueue` | `approvals/` at `/approvals` | `PgApprovalQueue` | Draft actions awaiting a human |
| `IntegrationRegistry` | `integrations/` at `/integrations` | `PgIntegrationRegistry` | Which source systems are connected |

## Insight rules (`packages/contracts/src/core`)

- `evm.ts`: earned-value management per cost code, rolled up to the job. CPI = EV / AC, SPI = EV / PV, EAC = AC + (BAC - EV) / CPI, margin at completion = (contract - EAC) / contract. Trailing-window CPI so a job that went bad two weeks ago is not hidden by a healthy first month.
- `billing.ts`: field-ticket leakage (unsigned, signed-not-submitted, disputed), billing lag against a 14-day billing cycle, receivables, and cost booked to extra-work codes with no change order.
- `labour.ts`, `resources.ts`: overtime share, equipment idle days and burn, material slip against need dates, overdue safety actions.
- `alerts.ts`: named rules with explicit thresholds (`RULES`). Every signal carries severity, evidence, suggested action and owner.
- `brief.ts`: the inputs a narrator writes the daily brief from, with week-over-week deltas.

## Approvals and the one real write

An approval resolves inside a single transaction (`ApprovalsService.resolve`). Approving a `change-order-catcher` draft runs `ChangeOrderExecutor`, which inserts a pending change order for the extra-work cost code. Every other agent falls through to `DefaultExecutor`, which only records the decision: Evolv drafts, a person sends. No agent writes to accounting, payroll or safety systems.

## How to add a real connector

1. Implement the port interface in a new provider class, e.g. a Vista export reader implementing `ProjectSource`. Each connector extracts, normalizes into the canonical model through the job's cost-code mapping table, validates (totals tie out, no duplicate keys) and upserts with source lineage.
2. Change `useClass` for that port's token in the module file, or use `useFactory` to choose per company.
3. Nothing else changes. The web app and `packages/contracts` never knew which class sat behind the token.

## Local dev and deploy

See the README for commands. `apps/web` and `apps/api` deploy as two Vercel projects (`apps/api/api/index.ts` wraps Nest as an Express handler). `apps/api` needs `DATABASE_URL` and `WEB_ORIGIN`; `apps/web` needs `NEXT_PUBLIC_API_BASE_URL`. Apply `supabase/migrations/0002_oil_gas.sql` (0002 drops the restaurant tables from 0001) and run the seed before first use.
