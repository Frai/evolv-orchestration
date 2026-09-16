# Evolv demo site — Claude Code build spec

Purpose: a clickable, fully mocked web app that looks like the finished Evolv product. Shown to 10 restaurants and 3 hotels that signed LOIs, to collect their questions and objections before real integrations are built. Nothing here talks to a real vendor.

Read this whole file before writing code. Build in the session order at the bottom. Stop at each checkpoint and show the result.

## Non-negotiables

- All data is mock. No network calls to vendors, no LLM calls at runtime. "AI" text is pre-generated and stored in fixtures.
- Looks like a product, not a prototype. Real copy, real numbers, no lorem ipsum, no "TODO" visible.
- Folder structure mirrors the future hexagonal architecture so mock adapters get replaced, not rewritten.
- Deterministic mock data from a seeded generator. Same numbers every load.
- Deploys as a static site. No database, no auth server.

## Stack

- Next.js (App Router), TypeScript, Tailwind, shadcn/ui, Recharts
- Static export (`output: 'export'`), deploy to Vercel or Netlify
- Fake login: any email + password works; stores a session flag in memory only
- No env vars required to run

## Folder structure

```
/src
  /core            domain types and pure use cases (no React, no fetch)
    types.ts       Location, SalesDay, ItemSales, LabourDay, StockLevel, Brief, Alert, AgentRun, Approval
    brief.ts       buildBriefInput(location, date) — computes deltas from canonical data
    alerts.ts      detectAlerts(location, date) — rules over canonical data
  /ports           interfaces only
    SalesSource.ts LabourSource.ts InventorySource.ts AccountingSource.ts
    Narrator.ts Notifier.ts AgentRunner.ts
  /adapters
    /mock          one file per port; reads from /fixtures. These are the only adapters in this build.
  /fixtures        generated JSON (see generator)
  /app             Next.js routes
  /components
/scripts
  generate-fixtures.ts   seeded generator; `npm run fixtures` regenerates /src/fixtures
```

Rule: `/app` and `/components` import from `/core` and `/ports` only, never from `/fixtures` directly. Mock adapters are wired in one file: `/src/adapters/index.ts`.

## Mock world

Tenants (switchable from the top nav):

1. Prairie Table — full-service, dinner-heavy, ~$6k/day, 45 menu items, 22 staff. POS: Toast.
2. Bow Valley Burger Co. — quick-service, lunch-heavy, ~$3.5k/day, 18 items, 12 staff. POS: Square.
3. Northside Cantina — full-service with strong delivery share (30%), ~$5k/day, 38 items, 18 staff. POS: Lightspeed.
4. The Kensington Hotel — hotel with 3 F&B outlets (restaurant, bar, room service). Included deliberately to test whether the hotel signers see themselves in the product. POS: Toast per outlet. Shows "outlet" as a sub-location.

Generator produces, per location, 90 days ending yesterday:

- SalesDay: net sales, tax, tips, covers, order count, hourly breakdown (11:00–23:00), channel split (dine-in, takeout, delivery). Weekly seasonality: Fri/Sat +35%, Mon/Tue −20%. Two planted anomalies per location (one bad Saturday, one unexplained spike) so the brief has something to say.
- ItemSales: per item per day, with a long tail. Three "dead" items that sell <2/week.
- LabourDay: scheduled vs actual hours, hourly wage bands, labour cost. Planted: two overstaffed Tuesday lunches, one understaffed Friday.
- StockLevel: 25 tracked items with par levels; 4 below par today, 1 critical.
- Briefs: one per day for the last 14 days, pre-written text (3–5 short paragraphs each) that references the actual numbers in the fixture. Write these by hand in the generator as templates with number slots, not free prose.
- Alerts: derived by `/core/alerts.ts` at runtime from the fixtures, so the rules are real even though the data isn't.
- AgentRuns: 30 days of runs across the agents below, each with a trace.

## Pages

### /login
Fake. Logo, email, password, "Sign in". Any input works.

### / (Today)
The page an owner opens with coffee.
- Header: location switcher, date (yesterday), delivery channel badge ("Sent to WhatsApp 6:00 AM")
- The brief: pre-written narrative for yesterday
- Four tiles: net sales vs same weekday last 4 weeks, labour %, covers, delivery share. Each with a delta arrow.
- Alerts strip: today's alerts with severity, click through to source page
- "Ask about this day" input box: mocked. Typing and submitting shows a canned answer from a small lookup (5–6 pre-written Q&A pairs per location). Placeholder text suggests the questions that work.

### /sales
- 7 / 30 / 90 day toggle
- Net sales line with same-period-last-year ghost line
- By hour heatmap (day of week × hour)
- Channel split stacked bar
- Top 10 items and Dead items table with "consider removing" tag on dead ones

### /labour
- Labour cost % of sales, daily, with target line (28%)
- Scheduled vs actual hours by day
- "Overstaffed shifts" list with the planted Tuesdays; each row has "Suggest schedule change" that opens a mocked agent proposal (see /agents)

### /inventory
- Stock table: item, on hand, par, days of cover, status
- Below-par items pinned to top with "Draft reorder" button → creates a mocked Approval

### /integrations
The page that answers "does it work with my stuff." Grid of vendor cards, grouped by area:
- POS: Square, Toast, Lightspeed, TouchBistro, Clover
- Scheduling: 7shifts, Homebase, HotSchedules
- Inventory: MarketMan, MarginEdge, xtraCHEF
- Accounting: QuickBooks Online, Xero, Sage
- Delivery: Skip, DoorDash, Uber Eats
- Reservations: OpenTable, Resy
- Messaging: WhatsApp, Email, SMS

Each card has a state: Connected (green, shows "last sync 6:02 AM"), Available (Connect button → 3-step mocked OAuth modal that ends in Connected), Coming soon (grey). Per tenant, the POS on the fixture is Connected; 7shifts Connected for two tenants; everything else Available or Coming soon. Clicking Connect changes state in memory for the session.

### /agents
The orchestration story, made visible.
- Agent list with status and last run: Morning Brief, Sales Watch, Labour Optimizer, Inventory Guard, Guest Pulse (coming soon), Finance Insights (coming soon)
- Click an agent → run history
- Click a run → trace view: Goal → Plan (numbered steps) → each step shows tool called (e.g. `SalesSource.fetchSales`), input summary, output summary, duration → Outcome (brief sent / alert raised / approval requested). Render as a vertical timeline. All from fixtures.
- Orchestrator panel at top: "Last night: 4 agents, 11 steps, 1 approval pending, 0 errors" with a small run graph.

### /approvals
The governance story.
- Queue of proposed actions: "Reorder 40 lb chicken thigh from Sysco ($212)", "Cut one server from Tue 11:00–14:00 shift", "Remove 'Beet Tartare' from menu (sold 3 in 30 days)"
- Each shows the agent that proposed it, evidence (links to the numbers), and Approve / Reject / Edit
- Approve moves it to "Done" with a fake confirmation ("Sent to Sysco via email"). State is in memory.
- Settings toggle per agent: "Ask me first" vs "Act automatically" (visual only)

### /settings
Delivery channel (WhatsApp / Email / Both), send time, recipients, target labour %. Saves to memory.

## Design

- Clean, light, one accent color. No purple-gradient AI aesthetic.
- Numbers in tabular figures. Currency CAD.
- Mobile-first: owners will open this on a phone. Every page must work at 390px.
- Empty states and loading skeletons exist even though data is instant; they'll be needed later.

## Demo script (for Antonio and partner; not in the app)

Walk in this order and capture questions after each stop:
1. Today — "Is this the number you check every morning? What's missing?"
2. Integrations — "Which of these do you use? Which would you refuse to connect?"
3. Labour — "Would you act on this suggestion? Who else would need to see it?"
4. Approvals — "Would you let it act without asking? For what?"
5. Agents — "Does seeing how it works help or does it make you nervous?"
6. Hotel tenant (hotels only) — "Does this look like your business?"
Log answers in a shared sheet: location, page, question, quote, follow-up.

## Session order for Claude Code

Each session ends with `npm run build` passing and a screenshot.

1. Scaffold: Next.js, Tailwind, shadcn, static export config, folder structure, fake login, empty pages with nav. Checkpoint.
2. `/core/types.ts`, all port interfaces, `generate-fixtures.ts` producing the four tenants' sales + items. Checkpoint: print one tenant's last 7 days to console.
3. Mock adapters for SalesSource and Narrator (reads pre-written briefs). Today page with tiles and brief. Checkpoint.
4. Sales page. Checkpoint.
5. Labour fixtures + adapter + page. Alerts engine in `/core/alerts.ts`, alerts strip on Today. Checkpoint.
6. Inventory fixtures + page. Approvals data model, queue page, in-memory state. Checkpoint.
7. Integrations page with states and mocked connect flow. Checkpoint.
8. AgentRuns fixtures, agents page, trace view, orchestrator panel. Checkpoint.
9. Hotel tenant with outlets. Settings page. "Ask about this day" lookup. Checkpoint.
10. Mobile pass at 390px on every page. Deploy. Send link.

## Acceptance

- Every page renders for every tenant with no console errors
- No visible placeholder text
- Static export builds and deploys
- A non-technical person can click through the demo script without help
- Swapping `/src/adapters/index.ts` to point at a real SalesSource is the only change needed to make the Today page live

## Out of scope

Real auth, real vendor calls, real LLM calls, persistence across reloads, multi-user, i18n.

## Kickoff prompt for Claude Code

> Read BUILD_SPEC.md in full. We're building session 1 only. Scaffold the project exactly as the folder structure specifies, with fake login and empty pages wired into the nav. Do not generate fixtures or build any page content yet. When `npm run build` passes, stop and summarize what exists.
