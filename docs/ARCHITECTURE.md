# Architecture

## What this system is

Evolv is a mocked, fully clickable product demo for restaurants and hotels that have signed an LOI. It looks and behaves like the finished Evolv product — a morning brief, sales/labour/inventory dashboards, an approvals queue, and a set of "agents" that watch the numbers and propose actions — but nothing in it talks to a real POS, scheduling tool, or accounting system yet, and no model is called at runtime. Every number comes from a seeded, deterministic generator so the same demo date always produces the same story.

Five tenants ship with the demo: Prairie Table (full-service, Toast), Bow Valley Burger Co. (QSR, Square), Northside Cantina (delivery-heavy, Lightspeed), The Kensington Hotel (three F&B outlets, Toast), and The Early Bird (breakfast-only café, Clover). See the root `README.md` for the full domain story (kitchen-load tracking, alerts, agents) — this document is about how the system is put together, not what it shows.

## Why a frontend/backend split

The original build was a single Next.js app that imported its mock data adapters directly. That was fine for a static demo, but the intended shape of the real product is an **orchestrator backend** that talks to different vendor systems per tenant — Square here, Toast there, a scheduling tool for labour, an accounting system for cost data — while the frontend stays vendor-agnostic. Splitting into `apps/web` (Next.js) and `apps/api` (NestJS) now means the backend can grow into that role without ever touching the frontend again: every vendor integration is just a new adapter class behind an existing port.

## Hexagonal architecture across two apps

```
apps/web (Next.js, "use client" pages)
     |  fetch() via src/lib/api-client.ts
     v
apps/api (NestJS)
  Controllers  (HTTP surface — one per port)
     |
  Providers    (the adapters — inject a port token, implement a port interface)
     |
  Ports        (interfaces, defined in packages/contracts)
     |
     +--> MockSalesSource, MockLabourSource, ...   (reads apps/api/src/fixtures/data/*.json — live today)
     +--> SquarePOSAdapter, ToastPOSAdapter, ...    (stub classes, implement the port, not wired in — future work)

packages/contracts
  domain types + port interfaces + pure domain functions, shared by both apps
```

The shape is the same hexagonal architecture the single-app version already had (`core` / `ports` / `adapters`), just split across a process boundary: what used to be a same-process function call (`adapters.sales.getSalesDays(...)`) is now an HTTP call from `apps/web` to a NestJS controller, which delegates to whatever provider is currently wired to that port's injection token.

## Layer contracts — what's expected of each layer

- **`apps/web`** only imports from `@evolv/contracts` (types and pure domain functions) and its own `src/lib/api-client.ts`. It never imports a fixture file, a provider class, or anything from `apps/api`. If a page needs new data, the fix is a new endpoint on the relevant NestJS controller and a new method on `api-client.ts` — not a new import path into the backend.
- **`apps/api`** is the only thing that touches `apps/api/src/fixtures/**` or, eventually, a real vendor SDK/API key. Controllers depend only on port interfaces (`SalesSource`, `LabourSource`, ...), never on a concrete provider class — that's what makes swapping a mock for a real vendor a one-line change (see below).
- **`packages/contracts`** stays framework-free: no React, no Nest decorators, no `fetch`. It's plain TypeScript types and pure functions that both apps can depend on without pulling in the other app's runtime.

## The 9 ports

Each port from the original `src/ports/` has one NestJS module in `apps/api/src`, one controller exposing it over HTTP, and one mock provider reading from the fixture JSON.

| Port | Module / controller | Mock provider | Stub vendor adapters |
|---|---|---|---|
| `SalesSource` | `sales/` — `/sales` | `sales/providers/mock-sales.provider.ts` | `square-pos.provider.ts`, `toast-pos.provider.ts`, `lightspeed-pos.provider.ts`, `clover-pos.provider.ts` |
| `LabourSource` | `labour/` — `/labour` | `labour/providers/mock-labour.provider.ts` | — |
| `InventorySource` | `inventory/` — `/inventory` | `inventory/providers/mock-inventory.provider.ts` | — |
| `AccountingSource` | `accounting/` — `/accounting` | `accounting/providers/mock-accounting.provider.ts` | — |
| `Narrator` | `narrator/` — `/narrator` | `narrator/providers/mock-narrator.provider.ts` | — |
| `Notifier` | `notifier/` — `/notifier` | `notifier/providers/mock-notifier.provider.ts` | — |
| `AgentRunner` | `agents/` — `/agents` | `agents/providers/mock-agent-runner.provider.ts` | — |
| `ApprovalQueue` | `approvals/` — `/approvals` | `approvals/providers/mock-approval-queue.provider.ts` | — |
| `IntegrationRegistry` | `integrations/` — `/integrations` | `integrations/providers/mock-integration-registry.provider.ts` | — |

The four POS stub adapters (Square, Toast, Lightspeed, Clover) exist as files implementing `SalesSource`, each method throwing `"not implemented — <vendor>"` with a `// TODO` comment. They are **not** referenced by `SalesModule`'s provider array yet — they're scaffolding for the next phase of work, not live code.

## Target vendor landscape (Canada)

The vendor names in this doc (Square, Toast, Lightspeed, Clover, plus each tenant's assigned vendor in the mock world) aren't arbitrary — they're the systems most commonly found in Canadian restaurants and hotels today, and the ones a real orchestrator backend will eventually need adapters for. Grouped by port:

| Category | Port | Vendors | Notes |
|---|---|---|---|
| POS | `SalesSource` | **Lightspeed** (Canadian, Montreal), **Square**, **Toast**, **Clover**, **TouchBistro** (Canadian, Toronto), Micros/Oracle, Aloha (NCR Voyix) | Lightspeed and TouchBistro are Canadian-built and have strong domestic share; Clover is often bundled through bank merchant services (Moneris, TD, Desjardins); Micros/Aloha show up at enterprise/hotel scale — relevant for multi-outlet tenants like The Kensington Hotel |
| Scheduling / Labour | `LabourSource` | **7shifts** (Canadian, Saskatoon), When I Work, Deputy | 7shifts is restaurant-specific and the default assumption for `LabourSource` beyond the current mock |
| Inventory | `InventorySource` | MarketMan, Apicbase | |
| Accounting | `AccountingSource` | QuickBooks, Xero | |
| Delivery | (surfaced via `SalesSource`/alerts, not a dedicated port) | DoorDash, Uber Eats, **SkipTheDishes** (Canadian-specific) | Drives the delivery-intake pause proposals from the Kitchen Pacing agent |

Only the four POS vendors (Square, Toast, Lightspeed, Clover) have stub provider classes today (see the table above). TouchBistro and 7shifts are the next-most-relevant given Canadian market share and existing ports (`SalesSource`, `LabourSource` respectively) — same stub pattern applies when that work starts: implement the port interface, throw `"not implemented"` with a `// TODO`, don't wire it into the module's provider array until it's real.

## How to add a real vendor integration

1. Implement the port interface in a new (or the existing stub) provider class, e.g. `apps/api/src/sales/providers/square-pos.provider.ts`. Fill in the real API calls; keep the method signatures exactly matching `SalesSource`.
2. In the module file (`sales.module.ts`), change the `useClass` for that port's token:
   ```ts
   providers: [{ provide: SALES_SOURCE, useClass: SquarePOSAdapter }],
   ```
   You can also make this conditional on an env var (`useFactory` instead of `useClass`) if different tenants use different vendors at once.
3. Nothing else changes. `apps/web` never knew which class was behind `SALES_SOURCE` — it only ever called `apiClient.sales.getSalesDays(...)`, which hits `/sales/days` regardless of what's wired up server-side. `packages/contracts` doesn't change either, since the port interface was already vendor-agnostic.

This is the same "one line to swap a source" story the original single-app README described for `src/adapters/index.ts` — it now happens in NestJS's DI configuration instead of a plain object literal.

## Local dev

```bash
npm install               # from the repo root — installs all three workspaces
npm run dev                # turbo runs apps/web (:3000) and apps/api (:3001) together
```

`apps/api` regenerates its fixtures on `predev`/`prebuild` so "yesterday" is always yesterday; set `FIXTURE_TODAY=YYYY-MM-DD` to pin it. `apps/web` needs `NEXT_PUBLIC_API_BASE_URL` set (see `apps/web/.env.local.example`) — it defaults to `http://localhost:3001` if unset.

## Deploy topology

`apps/web` and `apps/api` are two separate Vercel projects, deployed and scaled independently:

- **`evolv-web`** — root directory `apps/web`. Still a static export (`output: "export"` in `next.config.ts`); every data-fetching page is already a client component, so static export deploys fine alongside a live backend. Env var: `NEXT_PUBLIC_API_BASE_URL` pointing at the `evolv-api` deployment.
- **`evolv-api`** — root directory `apps/api`. NestJS isn't zero-config on Vercel the way Next.js is, so `apps/api/api/index.ts` wraps the Nest app as an Express handler for a Vercel Function (see `apps/api/vercel.json`). Env var: `WEB_ORIGIN` set to the `evolv-web` deployment's URL, used for CORS in `apps/api/src/main.ts`.

Both projects should set their **Install Command** to run from the repo root (`npm install`, since this is an npm workspaces monorepo) and their **Build Command** to `npx turbo build --filter=@evolv/web` / `--filter=@evolv/api` respectively, so each project only rebuilds what changed.
