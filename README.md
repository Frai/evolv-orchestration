# Evolv demo site

A clickable, fully mocked web app that looks like the finished Evolv product. Built for the LOI restaurants and hotels to click through and react to. Nothing here talks to a real vendor, and no model is called at runtime.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # regenerates fixtures, then static export to ./out
npm run fixtures   # regenerate ./src/fixtures only
```

No environment variables. The build is a static export (`output: "export"`), so `./out` deploys to Vercel, Netlify, or any static host.

Sign in with any email and password. The session, approvals, integration states and settings live in memory and reset on reload.

## Layout

```
src/core        domain types and pure functions (brief deltas, alert rules, sales/labour/inventory maths)
src/ports       interfaces the app depends on: SalesSource, LabourSource, InventorySource,
                AccountingSource, Narrator, Notifier, AgentRunner, ApprovalQueue, IntegrationRegistry
src/adapters    mock/ implements every port from src/fixtures; index.ts is the only wiring file
src/fixtures    generated JSON, 90 days ending yesterday for four tenants
src/app         Next.js routes (App Router, static)
src/components  UI; imports from core, ports and adapters/index only, never from fixtures
scripts         generate-fixtures.ts and its seeded generator modules
```

Swapping a mock for a real source is a one-line change in `src/adapters/index.ts`.

## Mock world

Four tenants, switchable from the top bar: Prairie Table (Toast), Bow Valley Burger Co. (Square), Northside Cantina (Lightspeed) and The Kensington Hotel (Toast, three F&B outlets with an outlet sub-switcher).

The generator is seeded, so the same numbers come out every run for a given date. It plants, per tenant: one bad Saturday, one unexplained midweek spike, two overstaffed Tuesday lunches, one understaffed Friday, four stock items below par with one critical, and three dead menu items. Alerts are computed at runtime by `src/core/alerts.ts` over that data, so the rules are real even though the data is not.

Fixtures are regenerated on every build so "yesterday" is always yesterday. Set `FIXTURE_TODAY=YYYY-MM-DD` to pin the date.

## Pages

Today, Sales, Labour, Inventory, Approvals, Agents, Integrations, Settings, and a fake Login. Every page works at 390px wide.
