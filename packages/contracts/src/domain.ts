// Domain types. No React, no fetch, no fixtures.
//
// The canonical model Evolv translates every source system into. Connectors are thin
// translators into these shapes; no insight code ever touches a raw vendor schema.

export type Segment = "pipeline_civil" | "oilfield_services" | "lease_construction" | "facilities";
export type AccountingVendor = "sage300cre" | "vista" | "quickbooks" | "netsuite";
export type DeliveryChannel = "whatsapp" | "email" | "both";

export interface Company {
  id: string;
  name: string;
  shortName: string;
  segment: Segment;
  accounting: AccountingVendor;
  city: string;
  currency: "CAD";
  employeeCount: number;
  /** Margin the company bids to and expects to hold at completion. */
  targetMarginPct: number;
  owner: { name: string; role: string; phone: string; email: string };
}

export const SEGMENT_LABEL: Record<Segment, string> = {
  pipeline_civil: "Pipeline & civil",
  oilfield_services: "Oilfield services",
  lease_construction: "Lease construction",
  facilities: "Facilities & batteries",
};

export type JobStatus = "active" | "closing_out";

export interface Job {
  id: string;
  companyId: string;
  name: string;
  /** The operator the work is for. */
  client: string;
  contractValue: number;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  status: JobStatus;
  pm: string;
}

export type CostCategory = "labour" | "equipment" | "material" | "subcontract";
export const COST_CATEGORIES: CostCategory[] = ["labour", "equipment", "material", "subcontract"];
export const CATEGORY_LABEL: Record<CostCategory, string> = {
  labour: "Labour",
  equipment: "Equipment",
  material: "Material",
  subcontract: "Subcontract",
};

/** One line of the estimate (budget at completion) mapped to the contractor's cost-code list. */
export interface CostCode {
  id: string;
  jobId: string;
  code: string;
  name: string;
  category: CostCategory;
  /** Budget at completion for this code. Zero for extra work that was never estimated. */
  budget: number;
  plannedQty: number;
  unit: string;
  plannedStart: string;
  plannedEnd: string;
  /** Work that is not in the estimate (extra work booked to a catch-all code). */
  extra?: boolean;
}

/** One day of actual cost and field progress against one cost code. */
export interface CostDay {
  jobId: string;
  codeId: string;
  date: string;
  /** Labour codes only: total hours booked, of which `overtimeHours` were overtime. */
  hours: number;
  overtimeHours: number;
  cost: number;
  /** Quantity installed that day, in the code's unit. */
  qty: number;
}

export type ChangeOrderStatus = "draft" | "pending" | "approved" | "rejected";

export interface ChangeOrder {
  id: string;
  jobId: string;
  number: string;
  title: string;
  amount: number;
  status: ChangeOrderStatus;
  /** Extra-work cost code this change order covers. */
  codeId?: string;
  createdAt: string;
  submittedAt?: string;
}

export type TicketStatus = "open" | "signed" | "submitted" | "approved" | "disputed" | "paid";

/** The field ticket is the revenue document for a service contractor. */
export interface FieldTicket {
  id: string;
  companyId: string;
  jobId: string;
  number: string;
  date: string;
  crew: string;
  description: string;
  labourHours: number;
  equipmentHours: number;
  amount: number;
  status: TicketStatus;
  signedAt?: string;
  submittedAt?: string;
  disputeReason?: string;
}

export type InvoiceStatus = "draft" | "issued" | "paid" | "overdue";

export interface Invoice {
  id: string;
  jobId: string;
  number: string;
  periodEnd: string;
  amount: number;
  status: InvoiceStatus;
  issuedAt?: string;
  dueDate?: string;
  paidAt?: string;
}

export interface Equipment {
  id: string;
  jobId: string;
  name: string;
  type: string;
  ownership: "owned" | "rented";
  dailyRate: number;
  /** Hours used per day for the last 14 days, oldest first. */
  usageHours14: number[];
  /** Next maintenance service due, if known. */
  serviceDueDate?: string;
}

export type CommitmentStatus = "open" | "delivered" | "closed";

export interface Commitment {
  id: string;
  jobId: string;
  vendor: string;
  description: string;
  kind: "po" | "subcontract";
  committed: number;
  invoiced: number;
  promisedDate: string;
  /** Date the schedule needs the material or crew on site. */
  needDate: string;
  status: CommitmentStatus;
}

export type SafetyKind = "near_miss" | "incident" | "inspection_finding";

export interface SafetyEvent {
  id: string;
  jobId: string;
  kind: SafetyKind;
  date: string;
  title: string;
  /** Role who owns the corrective action. */
  owner: string;
  correctiveDue: string;
  status: "open" | "closed";
}

export interface Brief {
  companyId: string;
  date: string;
  headline: string;
  paragraphs: string[];
  /** ISO timestamp the brief was delivered. */
  deliveredAt: string;
  channel: DeliveryChannel;
}

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertSource = "margin" | "labour" | "change_orders" | "billing" | "tickets" | "equipment" | "materials" | "safety";

export interface AlertEvidence {
  label: string;
  value: string;
}

/** A self-explaining signal: severity, evidence, suggested action, owner. */
export interface Alert {
  id: string;
  companyId: string;
  jobId?: string;
  date: string;
  severity: AlertSeverity;
  source: AlertSource;
  title: string;
  detail: string;
  /** Route the alert links to. */
  href: string;
  suggestedAction: string;
  /** Role responsible for acknowledging the signal. */
  owner: string;
  evidence: AlertEvidence[];
}

export type AgentStatus = "active" | "coming_soon";
export type AgentMode = "ask_first" | "auto";

export interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  schedule: string;
  defaultMode: AgentMode;
}

export type RunStatus = "success" | "needs_approval" | "error";
export type OutcomeKind = "brief_sent" | "alert_raised" | "approval_requested" | "no_action" | "error";

export interface AgentStep {
  index: number;
  title: string;
  /** e.g. ProjectSource.getCostDays */
  tool: string;
  inputSummary: string;
  outputSummary: string;
  durationMs: number;
  status: "ok" | "error";
}

export interface AgentRun {
  id: string;
  agentId: string;
  companyId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: RunStatus;
  goal: string;
  steps: AgentStep[];
  outcome: { kind: OutcomeKind; summary: string };
}

export interface OrchestratorSummary {
  date: string;
  agents: number;
  steps: number;
  approvalsPending: number;
  errors: number;
  runs: AgentRun[];
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalEvidence {
  label: string;
  value: string;
  href: string;
}

export interface Approval {
  id: string;
  companyId: string;
  agentId: string;
  runId?: string;
  title: string;
  summary: string;
  amount?: number;
  /** Machine-readable reference, e.g. the extra-work cost code a change-order draft is for. */
  refId?: string;
  evidence: ApprovalEvidence[];
  status: ApprovalStatus;
  proposedAt: string;
  resolvedAt?: string;
  /** Shown after approval, e.g. "Change order CO-014 submitted to the client". */
  confirmation: string;
  /** Editable free-text version of the action, for the Edit flow. */
  action: string;
}

export type IntegrationArea = "accounting" | "estimating" | "timekeeping" | "field" | "ticketing" | "billing" | "equipment" | "safety" | "messaging";
export type IntegrationState = "connected" | "available" | "coming_soon";

export interface Integration {
  id: string;
  name: string;
  area: IntegrationArea;
  description: string;
  state: IntegrationState;
  lastSyncAt?: string;
}

export interface QAPair {
  companyId: string;
  question: string;
  keywords: string[];
  answer: string;
}

export interface Settings {
  deliveryChannel: DeliveryChannel;
  sendTime: string;
  recipients: string[];
  targetMarginPct: number;
}

export interface DeliveryReceipt {
  channel: DeliveryChannel;
  sentAt: string;
  to: string[];
}

export interface DateRange {
  /** Inclusive YYYY-MM-DD */
  from: string;
  /** Inclusive YYYY-MM-DD */
  to: string;
}
