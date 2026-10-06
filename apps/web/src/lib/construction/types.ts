/**
 * Construction domain for the Evolv GC demo. Framework-free: no React, no fetch.
 * Money is CAD. Dates are ISO yyyy-mm-dd strings.
 */

export type Province = "AB" | "ON" | "BC";

export interface Company {
  id: string;
  name: string;
  shortName: string;
  city: string;
  province: Province;
  /** One-line description of the kind of work they do. */
  segment: string;
  annualRevenue: number;
  /** Portfolio margin the owner wants to hold, as a ratio. */
  targetMarginPct: number;
  systems: { pm: string; accounting: string };
  owner: { name: string; title: string; email: string; phone: string };
  /** Provincial workers' comp board name, used in compliance copy. */
  wcbName: string;
  timeZone: string;
}

export type ProjectHealth = "on_track" | "watch" | "at_risk";
export type ProjectSector = "Healthcare" | "Multi-family" | "Education" | "Retail" | "Industrial" | "Office" | "Mixed-use" | "Civic";

export interface CostCode {
  code: string;
  name: string;
  budget: number;
  committed: number;
  actual: number;
  /** Forecast cost at completion for this code. */
  forecast: number;
}

export interface Project {
  id: string;
  companyId: string;
  number: string;
  name: string;
  client: string;
  sector: ProjectSector;
  city: string;
  pm: string;
  superintendent: string;
  /** Original contract value. */
  contractValue: number;
  /** Original cost budget. */
  originalBudget: number;
  pctComplete: number;
  billedToDate: number;
  startDate: string;
  baselineCompletion: string;
  forecastCompletion: string;
  costCodes: CostCode[];
  /** Weekly forecast margin, oldest first, last entry is this week. */
  marginHistory: { week: string; margin: number }[];
}

export type ChangeOrderStatus = "unpriced" | "pricing" | "submitted" | "approved" | "billed" | "rejected";
export type ChangeOrderOrigin = "Owner request" | "Design change" | "Unforeseen condition" | "RFI response" | "Code requirement";

export interface ChangeOrder {
  id: string;
  projectId: string;
  number: string;
  title: string;
  origin: ChangeOrderOrigin;
  status: ChangeOrderStatus;
  /** Cost to us (estimated until priced). */
  cost: number;
  /** Value to the owner (estimated until submitted). */
  value: number;
  /** Date the issue was raised. */
  raisedOn: string;
  /** Crews have already started the work. */
  fieldStarted: boolean;
  reference?: string;
}

export type MilestoneStatus = "done" | "on_track" | "slipping" | "late";

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  baseline: string;
  forecast: string;
  status: MilestoneStatus;
  critical: boolean;
}

export type ProcurementStatus = "submittal_pending" | "released" | "in_fabrication" | "shipped" | "delivered";

export interface ProcurementItem {
  id: string;
  projectId: string;
  item: string;
  supplier: string;
  leadWeeks: number;
  needBy: string;
  expectedDelivery: string;
  status: ProcurementStatus;
}

export type PayAppStatus = "not_received" | "received" | "under_review" | "approved" | "paid";

export interface Subcontractor {
  id: string;
  companyId: string;
  name: string;
  trade: string;
  projectIds: string[];
  contractValue: number;
  billedToDate: number;
  payApp: { period: string; amount: number; status: PayAppStatus; receivedOn?: string };
  wcbExpiry: string;
  insuranceExpiry: string;
  lienWaiver: "current" | "missing";
}

export type AlertSeverity = "critical" | "warning" | "info";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  href: string;
}

export interface Brief {
  companyId: string;
  date: string;
  deliveredAt: string;
  headline: string;
  paragraphs: string[];
}

export interface QAPair {
  question: string;
  keywords: string[];
  answer: string;
}

export type AgentMode = "ask_first" | "auto";
export type AgentStatus = "active" | "coming_soon";

export interface Agent {
  id: string;
  name: string;
  short: string;
  description: string;
  schedule: string;
  status: AgentStatus;
  defaultMode: AgentMode;
}

export type RunStatus = "success" | "needs_approval" | "error";
export type RunOutcomeKind = "brief_sent" | "alert_raised" | "approval_requested" | "no_action" | "error";

export interface RunStep {
  index: number;
  title: string;
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
  steps: RunStep[];
  outcome: { kind: RunOutcomeKind; summary: string };
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Approval {
  id: string;
  companyId: string;
  agentId: string;
  runId?: string;
  proposedAt: string;
  title: string;
  summary: string;
  action: string;
  amount?: number;
  evidence: { label: string; value: string; href: string }[];
  status: ApprovalStatus;
  confirmation: string;
  resolvedAt?: string;
}

export type IntegrationArea = "project_management" | "accounting" | "estimating" | "field" | "documents" | "messaging";
export type IntegrationState = "connected" | "available" | "coming_soon";

export interface Integration {
  id: string;
  name: string;
  area: IntegrationArea;
  description: string;
  state: IntegrationState;
  lastSyncAt?: string;
}

export type DeliveryChannel = "whatsapp" | "email" | "both";

export interface Settings {
  deliveryChannel: DeliveryChannel;
  sendTime: string;
  recipients: string[];
  targetMarginPct: number;
  /** Unpriced change work older than this many days raises an alert. */
  coAgingDays: number;
}
