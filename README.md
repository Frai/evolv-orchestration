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
src/fixtures    generated JSON, 90 days ending yesterday for five tenants
src/app         Next.js routes (App Router, static)
src/components  UI; imports from core, ports and adapters/index only, never from fixtures
scripts         generate-fixtures.ts and its seeded generator modules
```

Swapping a mock for a real source is a one-line change in `src/adapters/index.ts`.

## Mock world

Five tenants, switchable from the top bar: Prairie Table (Toast, dinner-heavy), Bow Valley Burger Co. (Square, quick-service lunch), Northside Cantina (Lightspeed, strong delivery share), The Kensington Hotel (Toast, three F&B outlets with an outlet sub-switcher), and The Early Bird (Clover, a breakfast/brunch café with a sharp 8–10am rush and no dinner service). Tracked hours run 07:00–23:00 so a breakfast rush and a late dinner service both fit in the same model.

The generator is seeded, so the same numbers come out every run for a given date. It plants, per tenant: one bad Saturday, one unexplained midweek sales spike, two overstaffed Tuesday lunches, one understaffed Friday, four stock items below par with one critical, three dead menu items, and — every day, on "yesterday" specifically — a burst of tickets at the location's own busiest hour that outruns its kitchen's comfortable pace (a hotel's three outlets converge on the same hour, the way a real hotel's dinner, bar and room service all get busy together). Alerts, the kitchen-load chart, the morning brief and the agent runs are all computed at runtime by `src/core` over that data, so the rules are real even though the data is not.

Fixtures are regenerated on every build so "yesterday" is always yesterday. Set `FIXTURE_TODAY=YYYY-MM-DD` to pin the date.

## Pages

Today, Sales (including a "Kitchen load, yesterday" chart), Labour, Inventory, Approvals, Agents, Integrations, Settings, and a fake Login. Every page works at 390px wide.

## The kitchen-load story

The sharpest piece of ops feedback so far: a kitchen can get slammed by a burst of orders landing at once, and that burst doesn't always show up as a busier sales day. `src/core/kitchen.ts` tracks tickets per hour against a location's (or hotel outlet's) comfortable ticket-per-hour pace, independent of net sales. When an hour outruns that pace, it shows up as an alert on Today, a chart on Sales, a line in the morning brief, an answer to "Did the kitchen keep up yesterday?", and a standing proposal from a new "Kitchen Pacing" agent to pause delivery-app or online-order intake for 20 minutes during that rush — the same kind of proposal the Labour Optimizer already makes for overstaffed shifts.
