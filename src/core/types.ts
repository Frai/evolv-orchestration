// Domain types. No React, no fetch, no fixtures.

export type LocationType = "full_service" | "quick_service" | "hotel";
export type PosVendor = "toast" | "square" | "lightspeed";
export type DeliveryChannel = "whatsapp" | "email" | "both";

export interface Outlet {
  id: string;
  name: string;
  kind: "restaurant" | "bar" | "room_service";
}

export interface WageBand {
  role: string;
  hourlyRate: number;
}

export interface Location {
  id: string;
  name: string;
  shortName: string;
  type: LocationType;
  pos: PosVendor;
  city: string;
  currency: "CAD";
  targetLabourPct: number;
  menuItemCount: number;
  staffCount: number;
  wageBands: WageBand[];
  /** Hotels only: F&B outlets that roll up into the location. */
  outlets?: Outlet[];
  owner: { name: string; phone: string; email: string };
}

export type Channel = "dine_in" | "takeout" | "delivery" | "room_service";
export const CHANNELS: Channel[] = ["dine_in", "takeout", "delivery", "room_service"];
export const CHANNEL_LABEL: Record<Channel, string> = {
  dine_in: "Dine-in",
  takeout: "Takeout",
  delivery: "Delivery",
  room_service: "Room service",
};

/** Hourly buckets run 11:00 through 23:00 inclusive (13 buckets). */
export const HOUR_START = 11;
export const HOUR_COUNT = 13;

export interface SalesDay {
  locationId: string;
  outletId?: string;
  /** YYYY-MM-DD */
  date: string;
  netSales: number;
  tax: number;
  tips: number;
  covers: number;
  orders: number;
  /** Net sales by hour, index 0 = 11:00 … index 12 = 23:00. */
  hourly: number[];
  channels: Record<Channel, number>;
  /** Net sales on the same weekday one year earlier. */
  lastYearNetSales: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
}

export interface ItemSales {
  locationId: string;
  outletId?: string;
  date: string;
  itemId: string;
  name: string;
  category: string;
  qty: number;
  netSales: number;
}

export type ShiftFlag = "overstaffed" | "understaffed";

export interface Shift {
  id: string;
  role: string;
  /** HH:MM */
  start: string;
  end: string;
  scheduledStaff: number;
  actualStaff: number;
  /** Staff the sales in this window would normally justify. */
  neededStaff: number;
  hourlyRate: number;
  salesInWindow: number;
  flag?: ShiftFlag;
}

export interface LabourDay {
  locationId: string;
  outletId?: string;
  date: string;
  scheduledHours: number;
  actualHours: number;
  labourCost: number;
  shifts: Shift[];
}

export type StockStatus = "ok" | "low" | "below_par" | "critical";

export interface StockLevel {
  locationId: string;
  itemId: string;
  name: string;
  category: string;
  unit: string;
  onHand: number;
  par: number;
  dailyUsage: number;
  unitCost: number;
  supplier: string;
  /** Last counted, ISO timestamp. */
  countedAt: string;
}

export interface Brief {
  locationId: string;
  date: string;
  headline: string;
  paragraphs: string[];
  /** ISO timestamp the brief was delivered. */
  deliveredAt: string;
  channel: DeliveryChannel;
}

export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  id: string;
  locationId: string;
  date: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  /** Route the alert links to. */
  href: string;
  source: "sales" | "labour" | "inventory";
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
  /** e.g. SalesSource.fetchSales */
  tool: string;
  inputSummary: string;
  outputSummary: string;
  durationMs: number;
  status: "ok" | "error";
}

export interface AgentRun {
  id: string;
  agentId: string;
  locationId: string;
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
  locationId: string;
  agentId: string;
  runId?: string;
  title: string;
  summary: string;
  amount?: number;
  evidence: ApprovalEvidence[];
  status: ApprovalStatus;
  proposedAt: string;
  resolvedAt?: string;
  /** Shown after approval, e.g. "Sent to Sysco via email". */
  confirmation: string;
  /** Editable free-text version of the action, for the Edit flow. */
  action: string;
}

export type IntegrationArea = "pos" | "scheduling" | "inventory" | "accounting" | "delivery" | "reservations" | "messaging";
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
  locationId: string;
  question: string;
  keywords: string[];
  answer: string;
}

export interface Settings {
  deliveryChannel: DeliveryChannel;
  sendTime: string;
  recipients: string[];
  targetLabourPct: number;
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
