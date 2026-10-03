# Evolv demo: oil & gas contractors

A clickable demo of Evolv for oil and gas field service and construction contractors. Evolv sits above a contractor's existing accounting, estimating, timekeeping, ticketing, fleet and safety systems and turns them into an operating picture: early warning of margin erosion, unbilled work, stuck field tickets, late material and overdue safety follow-up, with human-approved actions.

The data is synthetic and deterministic. The signal rules are real: they run at request time over the canonical model, so what you see is what the rules would say about real data. No vendor is called and no model runs at runtime. Plan and rationale: [`docs/OIL_GAS_PIVOT.md`](docs/OIL_GAS_PIVOT.md). Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

This is a Turborepo monorepo: a Next.js frontend (`apps/web`) over a NestJS backend (`apps/api`) backed by Postgres, with shared domain code in `packages/contracts`.

## Run it

```bash
npm install
# Postgres: apply supabase/migrations/*.sql, then seed it
DATABASE_URL=postgresql://... npm run seed --workspace=@evolv/api
npm run dev          # apps/web on :3000, apps/api on :3001
npm run test         # contracts, api and web unit tests
```

`apps/api` needs `DATABASE_URL` (see `apps/api/.env.example`; `WEB_ORIGIN` must match the web origin for CORS). `apps/web` needs `NEXT_PUBLIC_API_BASE_URL` (see `apps/web/.env.local.example`). Set `FIXTURE_TODAY=YYYY-MM-DD` before seeding to pin "yesterday". Seeding truncates and refills every demo table, so it is safe to rerun, and rerunning resets approvals.

Sign in with any email and password. The session lives in memory and resets on reload.

## Layout

```
apps/web                Next.js frontend (App Router, static export)
apps/api                NestJS backend, one module per port
  src/fixtures/gen      seeded generator for the mock world
packages/contracts      shared, framework-free: domain types, port interfaces, and the pure
                        domain functions (EVM, billing leakage, alert rules, brief inputs)
supabase/migrations     0001 restaurant schema (legacy), 0002 contractor schema
```

## Mock world

Four contractors, switchable from the top bar, each with three active jobs and a job filter:

- **Foothills Pipeline & Civil** (Calgary, Viewpoint Vista). Ridge Loop gathering line: rock excavation at CPI 0.70, $98k booked to an extra-work code with no change order, 25% overtime, line pipe landing nine days late. Highway 22 bore: $375k earned but not invoiced.
- **Peace River Oilfield Services** (Grande Prairie, QuickBooks, FieldCap, OpenInvoice). Field tickets stuck before billing: six unsigned, four signed but never submitted, two disputed. A rented vac truck idle all week. Swan Hills dig crew at 32% overtime.
- **Red Deer Roustabout & Lease Construction** (Sage 300 CRE). Gravel overrun on the Sundre road, a culvert package five days late, a safety corrective action seven days overdue.
- **Bow River Facilities Contractors** (NetSuite). $915k earned on Strathmore battery but not invoiced, an idle rented excavator, extra work on the Bassano meter station with a draft change order.

Every signal is a self-explaining record: severity, evidence, suggested action and owner. Tap one on Today for the evidence.

## Pages

Today, Jobs (earned-value S-curve and cost-code drill-down), Labour (overtime), Billing (field tickets, progress billing, change orders), Resources (equipment, materials and subcontracts, safety), Approvals, Agents, Integrations, Settings, and a fake Login. Every page works at 390px wide by construction (responsive grids, scrolling tables), though the mobile layout has not been checked in a browser since the rewrite.

## The one real write

Approving a Change-Order Catcher draft inserts a pending change order for the extra-work cost code, in the same transaction as the approval. The "booked with no change order" signal then clears on the next load. Every other agent drafts only: a person sends the email, the billing package or the reminder. Nothing writes back to accounting, payroll or safety systems, and safety is routed and reminded, never decided.
