# Evolv demo site

A clickable, fully mocked web app that looks like the finished Evolv product. Built for the LOI restaurants and hotels to click through and react to. Nothing here talks to a real vendor, and no model is called at runtime.

This is a Turborepo monorepo: a Next.js frontend (`apps/web`) talking over HTTP to a NestJS backend (`apps/api`). See **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** for the full picture — the hexagonal split, the 9 ports and their modules, and how to wire in a real vendor later.

## Run it

```bash
npm install         # from the repo root — installs all workspaces
npm run dev         # turbo runs apps/web (:3000) and apps/api (:3001) together
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
