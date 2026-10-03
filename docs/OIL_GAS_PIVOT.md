# Oil & Gas pivot

Branch: `oil-gas-pivot` (cut from `supabase-persistence`). Status: planning. No code changed yet.

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

## Gaps in the build plan to fix

1. Canonical model has no `FieldTicket` entity. Add it (ticket id, job, crew, labour/equipment/material lines, customer signature status, billing status).
2. No `AFE` / cost-center entity. Operators approve and code spend against AFEs.
3. Add an OpenInvoice-compatible export as a fourth pilot connector.
4. Consider reframing the pilot as ticket-to-invoice leakage (unbilled or disputed tickets) alongside EVM margin erosion. Test on discovery calls.

## Mapping from the current restaurant demo

| Restaurant port | O&G equivalent | Action |
|---|---|---|
| `SalesSource` (POS) | `FieldTicketSource` (ticketing / OpenInvoice) | Replace |
| `LabourSource` (7shifts) | `TimeSource` (ExakTime etc.) | Replace |
| `InventorySource` | `CommitmentSource` (POs, subcontracts, materials) | Replace |
| `AccountingSource` | `AccountingSource` (Sage / Vista / QuickBooks) | Keep, new shape (cost codes, job cost) |
| `Narrator`, `Notifier`, `AgentRunner`, `ApprovalQueue`, `IntegrationRegistry` | Same | Keep; swap agent set for Margin Sentinel, Change-Order Catcher, Billing Accelerator, etc. |

Pure domain functions in `packages/contracts/src/core` (`sales`, `labour`, `inventory`, `kitchen`) get replaced by EVM (CPI, SPI, EAC, margin at completion) and the rule-based signals from the build plan. `alerts` and `brief` carry over structurally.

## Open items

- Pilot customer: not identified. Entire connector set depends on one contractor's real systems. Target 5 discovery calls (Calgary / Alberta) before further build.
- Stack divergence: the build plan specifies Python / FastAPI / React; this repo is NestJS / Next.js / Supabase. Decide whether the demo stays on the current stack.
- Ownership of the connector SDK long-term (core Evolv role vs customer-maintained).
