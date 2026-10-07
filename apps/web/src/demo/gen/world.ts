import type { AccountingVendor, Company, CostCategory, Segment } from "@evolv/contracts/types";

export type JobKind = "pipeline" | "facility" | "lease" | "service";

export interface CodeSpec {
  code: string;
  name: string;
  category: CostCategory;
  /** Share of the job's budget at completion. A kind's shares sum to 1. */
  share: number;
  unit: string;
  /** Budget dollars per unit of quantity. */
  unitCost: number;
  /** Planned start and end as fractions of the job's duration. */
  start: number;
  end: number;
  /** Labour codes only: blended hourly cost used to turn dollars into hours. */
  hourlyCost?: number;
}

export const CODE_TEMPLATES: Record<JobKind, CodeSpec[]> = {
  pipeline: [
    { code: "01-100", name: "Mobilization & survey", category: "labour", share: 0.05, unit: "day", unitCost: 6_500, start: 0, end: 0.08, hourlyCost: 88 },
    { code: "02-100", name: "Clearing & grading", category: "equipment", share: 0.09, unit: "ha", unitCost: 14_000, start: 0.03, end: 0.25 },
    { code: "02-300", name: "Trenching & rock excavation", category: "equipment", share: 0.16, unit: "m", unitCost: 190, start: 0.12, end: 0.5 },
    { code: "03-100", name: "Line pipe supply", category: "material", share: 0.22, unit: "m", unitCost: 260, start: 0.1, end: 0.6 },
    { code: "03-200", name: "Welding & pipe installation", category: "labour", share: 0.17, unit: "joint", unitCost: 2_100, start: 0.18, end: 0.62, hourlyCost: 96 },
    { code: "03-300", name: "Coating & NDE", category: "subcontract", share: 0.06, unit: "joint", unitCost: 720, start: 0.3, end: 0.7 },
    { code: "04-100", name: "Backfill & compaction", category: "equipment", share: 0.07, unit: "m", unitCost: 85, start: 0.35, end: 0.75 },
    { code: "05-100", name: "Hydrotest & commissioning", category: "subcontract", share: 0.05, unit: "section", unitCost: 24_000, start: 0.7, end: 0.92 },
    { code: "06-100", name: "Reclamation & restoration", category: "labour", share: 0.13, unit: "ha", unitCost: 9_800, start: 0.75, end: 1, hourlyCost: 74 },
  ],
  facility: [
    { code: "01-100", name: "Site prep & civil", category: "equipment", share: 0.12, unit: "m3", unitCost: 62, start: 0, end: 0.18 },
    { code: "02-100", name: "Foundations & concrete", category: "labour", share: 0.14, unit: "m3", unitCost: 1_150, start: 0.1, end: 0.35, hourlyCost: 82 },
    { code: "03-100", name: "Structural steel & equipment setting", category: "labour", share: 0.13, unit: "tonne", unitCost: 2_900, start: 0.25, end: 0.5, hourlyCost: 94 },
    { code: "04-100", name: "Process piping fabrication", category: "labour", share: 0.16, unit: "spool", unitCost: 3_400, start: 0.3, end: 0.65, hourlyCost: 98 },
    { code: "04-200", name: "Piping & valve material", category: "material", share: 0.18, unit: "spool", unitCost: 3_900, start: 0.2, end: 0.6 },
    { code: "05-100", name: "Electrical & instrumentation", category: "subcontract", share: 0.13, unit: "loop", unitCost: 5_200, start: 0.4, end: 0.8 },
    { code: "06-100", name: "Painting & insulation", category: "subcontract", share: 0.04, unit: "m2", unitCost: 52, start: 0.65, end: 0.85 },
    { code: "07-100", name: "Commissioning & turnover", category: "labour", share: 0.1, unit: "system", unitCost: 18_500, start: 0.8, end: 1, hourlyCost: 90 },
  ],
  lease: [
    { code: "01-100", name: "Survey & clearing", category: "labour", share: 0.08, unit: "ha", unitCost: 6_200, start: 0, end: 0.12, hourlyCost: 72 },
    { code: "02-100", name: "Grading & subgrade", category: "equipment", share: 0.22, unit: "m", unitCost: 340, start: 0.08, end: 0.5 },
    { code: "02-200", name: "Gravel supply & placement", category: "material", share: 0.26, unit: "m3", unitCost: 58, start: 0.25, end: 0.75 },
    { code: "03-100", name: "Culverts & drainage material", category: "material", share: 0.1, unit: "each", unitCost: 4_800, start: 0.15, end: 0.55 },
    { code: "03-200", name: "Culvert installation", category: "labour", share: 0.08, unit: "each", unitCost: 3_900, start: 0.2, end: 0.6, hourlyCost: 78 },
    { code: "04-100", name: "Fencing & cattle guards", category: "subcontract", share: 0.06, unit: "each", unitCost: 7_400, start: 0.6, end: 0.85 },
    { code: "05-100", name: "Reclamation & cleanup", category: "labour", share: 0.2, unit: "ha", unitCost: 8_600, start: 0.7, end: 1, hourlyCost: 70 },
  ],
  service: [
    { code: "01-100", name: "Crew labour", category: "labour", share: 0.38, unit: "crew-day", unitCost: 4_600, start: 0, end: 1, hourlyCost: 84 },
    { code: "02-100", name: "Equipment (vac trucks, hot oilers)", category: "equipment", share: 0.27, unit: "unit-day", unitCost: 1_900, start: 0, end: 1 },
    { code: "03-100", name: "Fluids & materials", category: "material", share: 0.15, unit: "load", unitCost: 1_350, start: 0, end: 1 },
    { code: "04-100", name: "Disposal & hauling", category: "subcontract", share: 0.12, unit: "load", unitCost: 980, start: 0, end: 1 },
    { code: "05-100", name: "Camp & travel", category: "subcontract", share: 0.08, unit: "crew-day", unitCost: 640, start: 0, end: 1 },
  ],
};

/** From `from` days before the as-of date onwards, a code's cost or schedule performance shifts to `factor`. */
export interface Drift {
  code: string;
  from: number;
  factor: number;
}

export interface ExtraWork {
  code: string;
  name: string;
  /** Days before the as-of date the extra work started. */
  startedAgo: number;
  /** Workdays it ran. */
  days: number;
  dailyCost: number;
  dailyHours: number;
}

export interface JobSpec {
  id: string;
  companyId: string;
  name: string;
  client: string;
  kind: JobKind;
  contractValue: number;
  /** Budget at completion as a share of contract value: 1 - bid margin. */
  bacRatio: number;
  durationDays: number;
  startedAgo: number;
  pm: string;
  /** Typical cost performance for the whole job, before drifts. */
  baseCpi: number;
  cpiDrifts?: Drift[];
  spiDrifts?: Drift[];
  /** Overtime share of labour hours: normal, and over the last 10 days. */
  overtime: { normal: number; recent: number };
  extra?: ExtraWork;
  /** The latest progress invoice is still a draft, so earned work runs ahead of billing. */
  billingLag?: boolean;
  /** An issued invoice is past its due date. */
  overdueInvoice?: boolean;
}

export const COMPANIES: Company[] = [
  {
    id: "foothills-pipeline",
    name: "Foothills Pipeline & Civil",
    shortName: "Foothills",
    segment: "pipeline_civil",
    accounting: "vista",
    city: "Calgary, AB",
    currency: "CAD",
    employeeCount: 140,
    targetMarginPct: 0.12,
    owner: { name: "Dana Whitfield", role: "Controller", phone: "+1 403 555 0142", email: "dana@foothillspipeline.example" },
  },
  {
    id: "peace-river-oilfield",
    name: "Peace River Oilfield Services",
    shortName: "Peace River",
    segment: "oilfield_services",
    accounting: "quickbooks",
    city: "Grande Prairie, AB",
    currency: "CAD",
    employeeCount: 85,
    targetMarginPct: 0.15,
    owner: { name: "Marcus Lindqvist", role: "Operations manager", phone: "+1 780 555 0177", email: "marcus@peaceriveros.example" },
  },
  {
    id: "red-deer-lease",
    name: "Red Deer Roustabout & Lease Construction",
    shortName: "Red Deer",
    segment: "lease_construction",
    accounting: "sage300cre",
    city: "Red Deer, AB",
    currency: "CAD",
    employeeCount: 60,
    targetMarginPct: 0.14,
    owner: { name: "Priya Anand", role: "Project manager", phone: "+1 403 555 0108", email: "priya@reddeerlease.example" },
  },
  {
    id: "bow-river-facilities",
    name: "Bow River Facilities Contractors",
    shortName: "Bow River",
    segment: "facilities",
    accounting: "netsuite",
    city: "Calgary, AB",
    currency: "CAD",
    employeeCount: 110,
    targetMarginPct: 0.11,
    owner: { name: "Tom Brennan", role: "VP operations", phone: "+1 403 555 0119", email: "tom@bowriverfacilities.example" },
  },
];

export const SEGMENT_OF = (c: Company): Segment => c.segment;
export const ACCOUNTING_OF = (c: Company): AccountingVendor => c.accounting;

// Each company has one flagship job carrying most of its stories, and two that are mostly healthy.
export const JOBS: JobSpec[] = [
  // ---- Foothills Pipeline & Civil: margin erosion + unbilled extra work
  {
    id: "ridge-loop",
    companyId: "foothills-pipeline",
    name: "Ridge Loop 12-inch Gathering Line",
    client: "Summit Creek Energy",
    kind: "pipeline",
    contractValue: 4_800_000,
    bacRatio: 0.87,
    durationDays: 140,
    startedAgo: 64,
    pm: "Kyle Reimer",
    baseCpi: 1.0,
    cpiDrifts: [
      { code: "02-300", from: 34, factor: 0.7 },
      { code: "03-200", from: 22, factor: 0.9 },
    ],
    overtime: { normal: 0.07, recent: 0.24 },
    extra: { code: "99-100", name: "Rock excavation (T&M, outside scope)", startedAgo: 27, days: 19, dailyCost: 5_100, dailyHours: 84 },
    billingLag: false,
  },
  {
    id: "kootenay-pad",
    companyId: "foothills-pipeline",
    name: "Kootenay Compressor Pad Civil",
    client: "Northern Ridge Midstream",
    kind: "facility",
    contractValue: 2_100_000,
    bacRatio: 0.86,
    durationDays: 120,
    startedAgo: 58,
    pm: "Aisha Rahman",
    baseCpi: 1.02,
    overtime: { normal: 0.06, recent: 0.08 },
  },
  {
    id: "hwy22-bore",
    companyId: "foothills-pipeline",
    name: "Highway 22 Crossing Bore",
    client: "Summit Creek Energy",
    kind: "pipeline",
    contractValue: 1_650_000,
    bacRatio: 0.88,
    durationDays: 90,
    startedAgo: 55,
    pm: "Kyle Reimer",
    baseCpi: 1.01,
    overtime: { normal: 0.06, recent: 0.09 },
    billingLag: true,
    overdueInvoice: true,
  },

  // ---- Peace River Oilfield Services: tickets leaking before billing, overtime, idle iron
  {
    id: "pad-14-22",
    companyId: "peace-river-oilfield",
    name: "Pad 14-22 Wellsite Services Program",
    client: "Montney Basin Resources",
    kind: "service",
    contractValue: 1_450_000,
    bacRatio: 0.85,
    durationDays: 110,
    startedAgo: 62,
    pm: "Marcus Lindqvist",
    baseCpi: 1.0,
    overtime: { normal: 0.08, recent: 0.12 },
  },
  {
    id: "two-hills-reclaim",
    companyId: "peace-river-oilfield",
    name: "Two Hills Lease Reclamation Program",
    client: "Northern Ridge Midstream",
    kind: "service",
    contractValue: 920_000,
    bacRatio: 0.84,
    durationDays: 100,
    startedAgo: 50,
    pm: "Shauna Boychuk",
    baseCpi: 1.03,
    overtime: { normal: 0.06, recent: 0.07 },
  },
  {
    id: "swan-hills-dig",
    companyId: "peace-river-oilfield",
    name: "Swan Hills Integrity Dig Program",
    client: "Summit Creek Energy",
    kind: "service",
    contractValue: 1_120_000,
    bacRatio: 0.85,
    durationDays: 95,
    startedAgo: 54,
    pm: "Marcus Lindqvist",
    baseCpi: 0.99,
    cpiDrifts: [{ code: "01-100", from: 16, factor: 0.9 }],
    overtime: { normal: 0.1, recent: 0.31 },
  },

  // ---- Red Deer Roustabout & Lease Construction: late material, overdue safety action, gravel overrun
  {
    id: "joffre-lease",
    companyId: "red-deer-lease",
    name: "Joffre Lease Expansion",
    client: "Prairie Basin Operating",
    kind: "lease",
    contractValue: 1_900_000,
    bacRatio: 0.86,
    durationDays: 100,
    startedAgo: 52,
    pm: "Priya Anand",
    baseCpi: 1.0,
    overtime: { normal: 0.07, recent: 0.1 },
  },
  {
    id: "pembina-tie-in",
    companyId: "red-deer-lease",
    name: "Pembina Tie-in Package",
    client: "Prairie Basin Operating",
    kind: "pipeline",
    contractValue: 1_200_000,
    bacRatio: 0.87,
    durationDays: 85,
    startedAgo: 46,
    pm: "Cody Marchand",
    baseCpi: 1.02,
    overtime: { normal: 0.06, recent: 0.07 },
  },
  {
    id: "sundre-road",
    companyId: "red-deer-lease",
    name: "Sundre Access Road Rebuild",
    client: "Foothills Gas Co-op",
    kind: "lease",
    contractValue: 810_000,
    bacRatio: 0.86,
    durationDays: 75,
    startedAgo: 49,
    pm: "Cody Marchand",
    baseCpi: 1.0,
    cpiDrifts: [{ code: "02-200", from: 26, factor: 0.78 }],
    overtime: { normal: 0.07, recent: 0.1 },
  },

  // ---- Bow River Facilities Contractors: schedule slip, idle iron, extra work with a draft change order
  {
    id: "strathmore-battery",
    companyId: "bow-river-facilities",
    name: "Strathmore Battery Expansion",
    client: "Prairie Basin Operating",
    kind: "facility",
    contractValue: 5_600_000,
    bacRatio: 0.88,
    durationDays: 160,
    startedAgo: 71,
    pm: "Tom Brennan",
    baseCpi: 1.0,
    spiDrifts: [{ code: "04-100", from: 30, factor: 0.76 }],
    cpiDrifts: [{ code: "04-100", from: 30, factor: 0.9 }],
    overtime: { normal: 0.08, recent: 0.15 },
    billingLag: true,
  },
  {
    id: "brooks-compressor",
    companyId: "bow-river-facilities",
    name: "Brooks Compressor Station Tie-ins",
    client: "Northern Ridge Midstream",
    kind: "facility",
    contractValue: 3_000_000,
    bacRatio: 0.87,
    durationDays: 130,
    startedAgo: 60,
    pm: "Lena Kowalski",
    baseCpi: 1.03,
    overtime: { normal: 0.06, recent: 0.07 },
  },
  {
    id: "bassano-meter",
    companyId: "bow-river-facilities",
    name: "Bassano Meter Station Retrofit",
    client: "Foothills Gas Co-op",
    kind: "facility",
    contractValue: 1_300_000,
    bacRatio: 0.88,
    durationDays: 90,
    startedAgo: 48,
    pm: "Lena Kowalski",
    baseCpi: 1.0,
    overtime: { normal: 0.07, recent: 0.1 },
    extra: { code: "99-100", name: "Buried obstruction removal (T&M)", startedAgo: 12, days: 8, dailyCost: 2_900, dailyHours: 52 },
  },
];
