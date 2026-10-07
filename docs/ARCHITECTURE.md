# Architecture

## What this system is

Evolv for oil and gas contractors: a read-mostly layer above a contractor's existing project, accounting, timekeeping, ticketing, fleet and safety systems. This repo is a demo, and the demo is fake on purpose: a static Next.js site that generates a seeded, deterministic world in the browser. There is no backend and no database, nothing talks to a real vendor, and no model runs. See `docs/OIL_GAS_PIVOT.md` for the segment, the systems landscape and the build plan this follows.

## Hexagonal architecture, in one app

```
apps/web (Next.js, "use client" pages)
     |  apiClient.<port>.<method>()                    src/lib/api-client.ts
     v
Ports  (interfaces in packages/contracts)
     |
     +--> src/demo/backend.ts   implements all nine ports over the in-browser store   (live today)
     +--> real connectors (Vista, Sage, FieldCap, OpenInvoice, ExakTime, ...)          (future)

packages/contracts
  domain types + port interfaces + pure domain functions, used by the pages and the demo backend
```

The ports are the seam. Pages call `apiClient`, which today delegates to `src/demo/backend.ts`. A real build keeps the pages and `packages/contracts` and swaps the backend for connectors behind the same interfaces, on a server this time.

## Layer contracts

- **Pages and components** import only from `@evolv/contracts` (types and pure functions) and `src/lib/api-client.ts`. They never import from `src/demo`. Dashboards load one `Snapshot` per company (`loadSnapshot`) and compute everything else with the pure functions, so signals, forecasts and brief inputs are the same code a server would run.
- **`src/demo`** is the only code that knows the data is fake: the generator (`gen/`), the store (`store.ts`) and the port implementations (`backend.ts`).
- **`packages/contracts`** stays framework-free: no React, no `fetch`.

## Canonical model

Every source dialect translates into one small model (`domain.ts`): `Company`, `Job`, `CostCode` (estimate line, budget at completion), `CostDay` (actual cost, hours, overtime and quantity installed per code per day), `FieldTicket`, `ChangeOrder`, `Invoice`, `Equipment`, `Commitment`, `SafetyEvent`. Connectors are thin translators; no insight code touches a raw vendor schema. Granularity follows one chain: cost code, then job, then portfolio, because that is the path every margin signal drills down through.

## The ports

| Port | Backed by (demo) | What it stands for |
|---|---|---|
| `ProjectSource` | `projects` in `backend.ts` | Accounting job cost, estimate, timekeeping, field progress |
| `BillingSource` | `billing` | Field tickets, progress invoices, change orders |
| `ResourceSource` | `resources` | Fleet telematics, purchase orders, subcontracts |
| `SafetySource` | `safety` | Incidents, near-misses, corrective actions |
| `Narrator` | `narrator` | Pre-written daily briefs and Q&A |
| `Notifier` | `notifier` | Delivery log |
| `AgentRunner` | `agents` | Agent runs and traces |
| `ApprovalQueue` | `approvals` | Draft actions awaiting a human |
| `IntegrationRegistry` | `integrations` | Which source systems are connected |

## Insight rules (`packages/contracts/src/core`)

- `evm.ts`: earned-value management per cost code, rolled up to the job. CPI = EV / AC, SPI = EV / PV, EAC = AC + (BAC - EV) / CPI, margin at completion = (contract - EAC) / contract. Trailing-window CPI so a job that went bad two weeks ago is not hidden by a healthy first month.
- `billing.ts`: field-ticket leakage (unsigned, signed-not-submitted, disputed), billing lag against a 14-day billing cycle, receivables, and cost booked to extra-work codes with no change order.
- `labour.ts`, `resources.ts`: overtime share, equipment idle days and burn, material slip against need dates, overdue safety actions.
- `alerts.ts`: named rules with explicit thresholds (`RULES`). Every signal carries severity, evidence, suggested action and owner.
- `brief.ts`: the inputs a narrator writes the daily brief from, with week-over-week deltas.

## Approvals and the one real write

`approvals.resolve` records a decision once; resolving an already-decided approval does nothing, so it cannot write twice. Approving a `change-order-catcher` draft also adds a pending change order for the extra-work cost code, so the "no change order on file" signal clears on the next snapshot load. Every other agent only records the decision: Evolv drafts, a person sends. No agent writes to accounting, payroll or safety systems.

## The fake world

`gen/build.ts` assembles four contractors with three jobs each. It is seeded, so the same date always gives the same numbers, and "yesterday" is the last weekday because crews book no cost on weekends. Stories are planted on purpose (margin erosion, unbilled extra work, stuck tickets, late material, overdue safety action) and the rules find them for real. Only the latest day's agent runs and approvals come from the live signals; earlier days are "no action" or "still open". The world is built on first use and held in memory (`store.ts`), so it resets on reload.

## How to add a real connector

1. Implement the port interface in a new class on a server, e.g. a Vista export reader implementing `ProjectSource`. Each connector extracts, normalizes into the canonical model through the job's cost-code mapping table, validates (totals tie out, no duplicate keys) and upserts with source lineage.
2. Replace the matching assignment in `src/lib/api-client.ts` with a fetch client that has the same method names.
3. Nothing else changes. The pages and `packages/contracts` never knew the data was fake.

## Local dev and deploy

`npm run dev`, `npm run test`, `npm run build` (static export to `apps/web/out`). It deploys as a single Vercel project with root `apps/web`; `apps/web/vercel.json` installs from the repo root and builds contracts then web. No environment variables are needed.
