# Evolv demo: oil & gas contractors

A clickable demo of Evolv for oil and gas field service and construction contractors. Evolv sits above a contractor's existing accounting, estimating, timekeeping, ticketing, fleet and safety systems and turns them into an operating picture: early warning of margin erosion, unbilled work, stuck field tickets, late material and overdue safety follow-up, with human-approved actions.

**The whole thing runs in the browser.** There is no backend and no database. The data is synthetic and deterministic, generated on first load. The signal rules are real: they run over the canonical model at request time, so what you see is what the rules would say about real data. No vendor is called and no model runs. Plan and rationale: [`docs/OIL_GAS_PIVOT.md`](docs/OIL_GAS_PIVOT.md). Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

This is a Turborepo monorepo: a Next.js static site (`apps/web`) and shared domain code (`packages/contracts`).

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run test     # contracts and web unit tests
npm run build    # static export to apps/web/out
```

Sign in with any email and password. Everything resets on reload. Set `NEXT_PUBLIC_FIXTURE_TODAY=YYYY-MM-DD` to pin "yesterday" (it otherwise follows the real date, skipping weekends).

## Layout

```
apps/web                Next.js frontend (App Router, static export)
  src/demo              the fake world: seeded generator (gen/), in-browser store, and the nine
                        ports from @evolv/contracts implemented over it (backend.ts)
  src/lib/api-client.ts the only way pages get data; today it delegates to src/demo/backend.ts
packages/contracts      shared, framework-free: domain types, port interfaces, and the pure
                        domain functions (EVM, billing leakage, alert rules, brief inputs)
```

## Mock world

Four contractors, switchable from the top bar, each with three active jobs and a job filter:

- **Foothills Pipeline & Civil** (Calgary, Viewpoint Vista). Ridge Loop gathering line: rock excavation at CPI 0.70, $98k booked to an extra-work code with no change order, 25% overtime, line pipe landing nine days late. Highway 22 bore: $375k earned but not invoiced.
- **Peace River Oilfield Services** (Grande Prairie, QuickBooks, FieldCap, OpenInvoice). Field tickets stuck before billing: six unsigned, four signed but never submitted, two disputed. A rented vac truck idle all week. Swan Hills dig crew at 32% overtime.
- **Red Deer Roustabout & Lease Construction** (Sage 300 CRE). Gravel overrun on the Sundre road, a culvert package five days late, a safety corrective action seven days overdue.
- **Bow River Facilities Contractors** (NetSuite). $915k earned on Strathmore battery but not invoiced, an idle rented excavator, extra work on the Bassano meter station with a draft change order.

Every signal is a self-explaining record: severity, evidence, suggested action and owner. Tap one on Today for the evidence.

## Pages

Today, Jobs (earned-value S-curve and cost-code drill-down), Labour (overtime), Billing (field tickets, progress billing, change orders), Resources (equipment, materials and subcontracts, safety), Approvals, Agents, Integrations, Settings, and a fake Login. The layout is responsive by construction (responsive grids, scrolling tables), though the mobile layout has not been checked in a browser since the rewrite.

## The one real write

Approving a Change-Order Catcher draft adds a pending change order for the extra-work cost code in the in-browser store, and the "booked with no change order" signal then clears. Every other agent drafts only: a person sends the email, the billing package or the reminder. Nothing writes back to accounting, payroll or safety systems, and safety is routed and reminded, never decided.
