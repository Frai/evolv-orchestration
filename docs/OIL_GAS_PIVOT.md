# Oil & Gas pivot

Branch: `oil-gas-pivot` (cut from `supabase-persistence`). Status: the demo has been rewritten for contractors (domain, API, fixtures, web). The connector SDK and real pilot build have not started.

Source docs: `Evolv_OG_One-Pager.pdf` and `Evolv_Orchestrator_Build_Plan.docx` (October 2026).

## Target segment

Oilfield **service and construction contractors** (roughly 20-200 employees, Alberta first) who sell to operators. Not operators: operators run heavyweight suites (Quorum, Enverus/P2, SAP IS-Oil, SCADA) with long enterprise sales cycles that don't fit a pilot-in-weeks pitch.

## Product shape

Read-only layer above the contractor's existing systems. First pilot: early warning of job-margin erosion on one active project. Phases: read-only insights, orchestration with approval-gated actions, supervised agents, portfolio view. Safety decisions always stay with humans (route and remind only).

## Systems landscape (what connectors target)

Sources are vendor and review sites, so treat market-share claims as directional. Verify with discovery calls before building.

| Category | Systems | Notes |
|---|---|---|
| Field ticketing / dispatch | FieldCap, FieldEquip, Spira, ServiceMax FieldFX, Enverus OSS / OpenTicket | The field ticket is the revenue document for service shops |
| Billing to operators | Enverus OpenInvoice | 450+ operators use it; field tickets flow into it. Highest-priority connector |
| Accounting / ERP | QuickBooks, Sage, Viewpoint Vista, Spectrum, NetSuite, Dynamics 365 BC, SAP | FieldEquip's integration list is a decent proxy for what the market runs |
| Small-shop roustabout software | Cantrell Jackson (with QuickBooks / Great Plains) | |
| Estimating / project (civil, pipeline) | HeavyBid, Procore, Primavera P6 | From the one-pager; less relevant to pure service shops |
| Timekeeping, telematics, safety | ExakTime, Samsara, Geotab, eCompliance, SiteDocs, Cority | From the one-pager |

Unverified, check before showing a prospect: RigER, hh2.

Operator-side (out of scope, listed for context): Quorum, Enverus/P2, WolfePak, Enertia, SAP IS-Oil, JD Edwards; SCADA via Emerson DeltaV, Honeywell Experion, ABB, AVEVA.

## Gaps in the build plan

1. `FieldTicket` was missing from the canonical model. **Done in the demo** (ticket, job, crew, hours, amount, signature and billing status).
2. No `AFE` / cost-center entity. Operators approve and code spend against AFEs. **Still open.**
3. OpenInvoice-compatible export as a fourth pilot connector. **In the integration catalog only**; no connector exists.
4. Pilot reframed to include ticket-to-invoice leakage alongside EVM margin erosion. **In the demo; still to be tested on discovery calls.**

## Mapping from the original restaurant demo (done)

| Restaurant port | O&G port | Notes |
|---|---|---|
| `SalesSource` (POS) | `ProjectSource` | Companies, jobs, cost codes, daily cost and field progress |
| `LabourSource` (7shifts) | folded into `ProjectSource` | Hours and overtime are columns on the daily cost rows |
| `InventorySource` | `ResourceSource` | Equipment and purchase orders / subcontracts |
| `AccountingSource` | `BillingSource` | Field tickets, invoices, change orders |
| (new) | `SafetySource` | Incidents and corrective actions; route and remind only |
| `Narrator`, `Notifier`, `AgentRunner`, `ApprovalQueue`, `IntegrationRegistry` | Same | Agent set is now Margin Sentinel, Labor Analyst, Change-Order Catcher, Billing Accelerator, Materials Watcher, Safety Coordinator |

## Open items

- Pilot customer: not identified. Entire connector set depends on one contractor's real systems. Target 5 discovery calls (Calgary / Alberta) before further build.
- Stack divergence: the build plan specifies Python / FastAPI / React; this repo is NestJS / Next.js / Supabase. Decide whether the demo stays on the current stack.
- Ownership of the connector SDK long-term (core Evolv role vs customer-maintained).
