# Evolv demo site

A clickable, fully mocked web app that looks like the finished Evolv product, now pointed at **mid-size general contractors** ($20–150M revenue, 5–15 active jobs). Nothing here talks to a real vendor, and no model is called at runtime.

> **Current state:** `apps/web` is the construction demo and is self-contained — its mock data, rules and API client live in `apps/web/src/lib`. It no longer calls `apps/api` or imports `packages/contracts`; those still hold the earlier restaurant/hotel build and are untouched. See [Construction demo](#construction-demo) below.

## Run it

```bash
npm install         # from the repo root — installs all workspaces
npm run dev         # turbo runs apps/web (:3000); apps/api (:3001) still starts but the web app doesn't call it
npm run build       # turbo builds packages/contracts, then apps/api and apps/web
npm run fixtures    # regenerate apps/api/src/fixtures/data only
```

`apps/web` needs `NEXT_PUBLIC_API_BASE_URL` (see `apps/web/.env.local.example`; defaults to `http://localhost:3001`). `apps/api` needs no environment variables locally. `apps/web`'s build is still a static export (`output: "export"`), and `apps/api`'s fixtures regenerate on every build so "yesterday" stays yesterday.

Sign in with any email and password. The session, approvals, integration states and settings live in memory and reset on reload.

## Layout

```
apps/web              Next.js frontend (App Router, static export)
  src/app             routes
  src/components      UI; imports only from @evolv/contracts and src/lib/api-client, never from fixtures
  src/lib/api-client   typed fetch client, one namespace per port

apps/api               NestJS backend — the orchestrator
  src/<port>/          one module + controller + mock provider per port (sales, labour, inventory,
                       accounting, narrator, notifier, agents, approvals, integrations)
  src/fixtures         generated JSON + the seeded generator that produces it

packages/contracts      shared, framework-free: domain types, port interfaces, pure domain functions
                        (brief deltas, alert rules, sales/labour/inventory maths)
```

Swapping a mock for a real vendor source is a one-line change in the relevant `apps/api/src/<port>/<port>.module.ts` (`useClass` on the port's injection token) — see `docs/ARCHITECTURE.md`.

## Mock world

Five tenants, switchable from the top bar: Prairie Table (Toast, dinner-heavy), Bow Valley Burger Co. (Square, quick-service lunch), Northside Cantina (Lightspeed, strong delivery share), The Kensington Hotel (Toast, three F&B outlets with an outlet sub-switcher), and The Early Bird (Clover, a breakfast/brunch café with a sharp 8–10am rush and no dinner service). Tracked hours run 07:00–23:00 so a breakfast rush and a late dinner service both fit in the same model.

The generator is seeded, so the same numbers come out every run for a given date. It plants, per tenant: one bad Saturday, one unexplained midweek sales spike, two overstaffed Tuesday lunches, one understaffed Friday, four stock items below par with one critical, three dead menu items, and — every day, on "yesterday" specifically — a burst of tickets at the location's own busiest hour that outruns its kitchen's comfortable pace (a hotel's three outlets converge on the same hour, the way a real hotel's dinner, bar and room service all get busy together). Alerts, the kitchen-load chart, the morning brief and the agent runs are all computed at runtime by the pure functions in `packages/contracts` over that data, so the rules are real even though the data is not.

Fixtures are regenerated on every build so "yesterday" is always yesterday. Set `FIXTURE_TODAY=YYYY-MM-DD` to pin the date.

## Pages

Today, Sales (including a "Kitchen load, yesterday" chart), Labour, Inventory, Approvals, Agents, Integrations, Settings, and a fake Login. Every page works at 390px wide.

## The kitchen-load story

The sharpest piece of ops feedback so far: a kitchen can get slammed by a burst of orders landing at once, and that burst doesn't always show up as a busier sales day. `packages/contracts/src/core/kitchen.ts` tracks tickets per hour against a location's (or hotel outlet's) comfortable ticket-per-hour pace, independent of net sales. When an hour outruns that pace, it shows up as an alert on Today, a chart on Sales, a line in the morning brief, an answer to "Did the kitchen keep up yesterday?", and a standing proposal from a new "Kitchen Pacing" agent to pause delivery-app or online-order intake for 20 minutes during that rush — the same kind of proposal the Labour Optimizer already makes for overstaffed shifts.


## Construction demo

`apps/web` is a construction-only frontend with a mocked backend:

```
apps/web/src/lib/construction/
  types.ts      domain: Company, Project, CostCode, ChangeOrder, Milestone, ProcurementItem, Subcontractor, ...
  fixtures.ts   hand-authored mock world; dates are offsets from "today" so it never goes stale
  core.ts       pure rules: job financials, portfolio roll-up, alerts, brief, Q&A, agent runs, approvals
  format.ts     CAD money, points, dates
apps/web/src/lib/api-client.ts   mocked client: same namespaces a real backend would expose, resolves from core.ts
```

Set `NEXT_PUBLIC_DEMO_TODAY=YYYY-MM-DD` to pin the demo date.

**Tenants:** Summit Ridge Builders (Calgary, Procore + Sage 300 CRE), Ironwood Construction (Toronto, Autodesk Build + Jonas Premier), Cascade Contracting (Vancouver, Procore + QuickBooks Online). Workers' comp and holdback copy follow each province (WCB Alberta, WSIB, WorkSafeBC; 10% holdback).

**The hero story: margin fade from unpriced change work.** Crews start extra work before it's priced. The cost lands in job cost; the revenue doesn't, so the job looks fine in accounting while forecast margin slides. On Riverside Medical Office, $480K of field-started changes takes the forecast from 8.5% to 5.0%; approved at estimate it comes back to 8.1%. The Change Order Chaser agent drafts pricing packages into Approvals. Each tenant has its own version (Danforth dewatering at Ironwood, Burnaby ductwork at Cascade), plus a schedule story (long-lead switchgear) and a cash/compliance story (expired workers' comp clearance, missing lien waivers, underbilling).

**Pages:** Today (brief, KPIs, alerts, ask box, jobs), Projects (list + job detail with margin trend, cost by code, schedule, changes), Change orders (pipeline and aging), Schedule (long-lead items, job timelines, milestones), Subs & payments (billing vs work in place, holdback, sub compliance), Approvals, Agents, Integrations, Settings. Every page works at 390px.

**Forecast margin** = (revised contract − forecast cost at completion) / revised contract, where forecast cost includes the cost of field-started changes that are not yet approved.
