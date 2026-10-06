/**
 * Hand-authored mock world for the GC demo. Dates are expressed as offsets from "today"
 * so the demo never goes stale. Cost codes and margin history are derived deterministically
 * from a few knobs per project; everything the UI shows on top of this is computed in core.ts.
 */
import type {
  ChangeOrder,
  ChangeOrderOrigin,
  ChangeOrderStatus,
  Company,
  CostCode,
  Integration,
  Milestone,
  MilestoneStatus,
  ProcurementItem,
  ProcurementStatus,
  Project,
  ProjectSector,
  Subcontractor,
} from "./types";
import { addDays } from "./format";

/** Today's date in Alberta, the demo's home time zone. */
export function todayISO(): string {
  const fixed = process.env.NEXT_PUBLIC_DEMO_TODAY;
  if (fixed) return fixed;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export const TODAY = todayISO();
const d = (offset: number) => addDays(TODAY, offset);

// ---------- deterministic noise ----------
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function noise(seed: string): number {
  return (hash(seed) % 10_000) / 10_000; // 0..1
}

// ---------- companies ----------
export const COMPANIES: Company[] = [
  {
    id: "summit-ridge",
    name: "Summit Ridge Builders",
    shortName: "Summit Ridge",
    city: "Calgary",
    province: "AB",
    segment: "Commercial and institutional GC",
    annualRevenue: 85_000_000,
    targetMarginPct: 0.075,
    systems: { pm: "Procore", accounting: "Sage 300 CRE" },
    owner: { name: "Dana Kowalczyk", title: "President", email: "dana@summitridgebuilders.ca", phone: "+1 403 555 0142" },
    wcbName: "WCB Alberta",
    timeZone: "America/Edmonton",
  },
  {
    id: "ironwood",
    name: "Ironwood Construction",
    shortName: "Ironwood",
    city: "Toronto",
    province: "ON",
    segment: "Mid-rise residential and institutional GC",
    annualRevenue: 140_000_000,
    targetMarginPct: 0.065,
    systems: { pm: "Autodesk Build", accounting: "Jonas Premier" },
    owner: { name: "Marco Bellini", title: "CEO", email: "marco@ironwoodconstruction.ca", phone: "+1 416 555 0187" },
    wcbName: "WSIB",
    timeZone: "America/Toronto",
  },
  {
    id: "cascade",
    name: "Cascade Contracting",
    shortName: "Cascade",
    city: "Vancouver",
    province: "BC",
    segment: "Tenant improvement and light commercial GC",
    annualRevenue: 32_000_000,
    targetMarginPct: 0.09,
    systems: { pm: "Procore", accounting: "QuickBooks Online" },
    owner: { name: "Priya Sandhu", title: "Owner", email: "priya@cascadecontracting.ca", phone: "+1 604 555 0119" },
    wcbName: "WorkSafeBC",
    timeZone: "America/Vancouver",
  },
];

// ---------- cost code templates ----------
interface CodeTemplate {
  code: string;
  name: string;
  weight: number;
  /** When in the job this code starts and how long it runs, as fractions of overall progress. */
  start: number;
  span: number;
}

const BUILDING_CODES: CodeTemplate[] = [
  { code: "01 00 00", name: "General requirements", weight: 0.09, start: 0, span: 1 },
  { code: "31 00 00", name: "Earthwork", weight: 0.04, start: 0, span: 0.15 },
  { code: "03 30 00", name: "Cast-in-place concrete", weight: 0.12, start: 0.05, span: 0.3 },
  { code: "05 12 00", name: "Structural steel", weight: 0.08, start: 0.2, span: 0.2 },
  { code: "06 10 00", name: "Rough carpentry", weight: 0.04, start: 0.3, span: 0.3 },
  { code: "07 50 00", name: "Roofing", weight: 0.04, start: 0.4, span: 0.15 },
  { code: "08 40 00", name: "Curtain wall and glazing", weight: 0.08, start: 0.4, span: 0.25 },
  { code: "09 20 00", name: "Drywall and framing", weight: 0.09, start: 0.45, span: 0.35 },
  { code: "09 60 00", name: "Flooring", weight: 0.04, start: 0.75, span: 0.2 },
  { code: "21 00 00", name: "Fire protection", weight: 0.03, start: 0.35, span: 0.45 },
  { code: "22 00 00", name: "Plumbing", weight: 0.07, start: 0.25, span: 0.6 },
  { code: "23 00 00", name: "HVAC", weight: 0.12, start: 0.3, span: 0.6 },
  { code: "26 00 00", name: "Electrical", weight: 0.13, start: 0.25, span: 0.7 },
  { code: "32 00 00", name: "Site improvements", weight: 0.03, start: 0.8, span: 0.2 },
];

const TI_CODES: CodeTemplate[] = [
  { code: "01 00 00", name: "General requirements", weight: 0.1, start: 0, span: 1 },
  { code: "02 41 00", name: "Demolition", weight: 0.06, start: 0, span: 0.12 },
  { code: "05 50 00", name: "Misc. metals", weight: 0.03, start: 0.1, span: 0.2 },
  { code: "06 40 00", name: "Millwork", weight: 0.11, start: 0.55, span: 0.35 },
  { code: "08 10 00", name: "Doors and hardware", weight: 0.05, start: 0.5, span: 0.3 },
  { code: "09 20 00", name: "Drywall and framing", weight: 0.14, start: 0.12, span: 0.45 },
  { code: "09 50 00", name: "Ceilings", weight: 0.06, start: 0.45, span: 0.25 },
  { code: "09 60 00", name: "Flooring", weight: 0.07, start: 0.7, span: 0.2 },
  { code: "09 90 00", name: "Painting", weight: 0.04, start: 0.65, span: 0.3 },
  { code: "21 00 00", name: "Fire protection", weight: 0.04, start: 0.15, span: 0.45 },
  { code: "22 00 00", name: "Plumbing", weight: 0.08, start: 0.12, span: 0.6 },
  { code: "23 00 00", name: "HVAC", weight: 0.11, start: 0.12, span: 0.65 },
  { code: "26 00 00", name: "Electrical", weight: 0.11, start: 0.12, span: 0.75 },
];

interface ProjectSpec {
  id: string;
  companyId: string;
  number: string;
  name: string;
  client: string;
  sector: ProjectSector;
  city: string;
  pm: string;
  superintendent: string;
  contractValue: number;
  originalMargin: number;
  pctComplete: number;
  /** Ratio of billed to earned. >1 is overbilled, <1 is underbilled. */
  billingRatio: number;
  startOffset: number;
  baselineOffset: number;
  slipDays: number;
  ti?: boolean;
  /** Cost code -> forecast overrun ratio (0.06 = 6% over budget). */
  overruns?: Record<string, number>;
  /** How the margin travelled over the last 12 weeks: "flat", "fade" (late slide), "recover". */
  trend: "flat" | "fade" | "slow_fade" | "recover";
}

const PROJECT_SPECS: ProjectSpec[] = [
  // Summit Ridge — the margin-fade story lives on Riverside.
  { id: "sr-2207", companyId: "summit-ridge", number: "SR-2207", name: "Riverside Medical Office", client: "Riverside Health Partners", sector: "Healthcare", city: "Calgary", pm: "Jordan Tate", superintendent: "Luis Ferreira", contractValue: 14_200_000, originalMargin: 0.085, pctComplete: 0.58, billingRatio: 0.97, startOffset: -290, baselineOffset: 190, slipDays: 9, overruns: { "09 20 00": 0.045, "26 00 00": 0.03 }, trend: "fade" },
  { id: "sr-2211", companyId: "summit-ridge", number: "SR-2211", name: "Bowmont Elementary Modernization", client: "Calgary West School Division", sector: "Education", city: "Calgary", pm: "Aisha Rahman", superintendent: "Greg Olson", contractValue: 9_800_000, originalMargin: 0.08, pctComplete: 0.72, billingRatio: 1.03, startOffset: -340, baselineOffset: 120, slipDays: 0, overruns: { "23 00 00": -0.02 }, trend: "flat" },
  { id: "sr-2302", companyId: "summit-ridge", number: "SR-2302", name: "Quarry Park Office, Levels 4–6", client: "Quarry Ridge Holdings", sector: "Office", city: "Calgary", pm: "Aisha Rahman", superintendent: "Mei Chen", contractValue: 3_400_000, originalMargin: 0.095, pctComplete: 0.91, billingRatio: 1.05, startOffset: -200, baselineOffset: 24, slipDays: 3, ti: true, overruns: { "06 40 00": -0.03 }, trend: "recover" },
  { id: "sr-2305", companyId: "summit-ridge", number: "SR-2305", name: "Seton Retail Pads B & C", client: "Southgate Commercial REIT", sector: "Retail", city: "Calgary", pm: "Jordan Tate", superintendent: "Greg Olson", contractValue: 5_600_000, originalMargin: 0.07, pctComplete: 0.35, billingRatio: 1.0, startOffset: -110, baselineOffset: 200, slipDays: 6, overruns: { "03 30 00": 0.11, "31 00 00": 0.08 }, trend: "slow_fade" },
  { id: "sr-2309", companyId: "summit-ridge", number: "SR-2309", name: "Foothills Cold Storage Expansion", client: "Prairie Fresh Logistics", sector: "Industrial", city: "Rocky View County", pm: "Sam Whitford", superintendent: "Luis Ferreira", contractValue: 11_900_000, originalMargin: 0.075, pctComplete: 0.22, billingRatio: 1.08, startOffset: -85, baselineOffset: 285, slipDays: 21, overruns: {}, trend: "flat" },
  { id: "sr-2312", companyId: "summit-ridge", number: "SR-2312", name: "Mahogany Community Library", client: "Southeast Calgary Library Board", sector: "Civic", city: "Calgary", pm: "Sam Whitford", superintendent: "Mei Chen", contractValue: 7_100_000, originalMargin: 0.08, pctComplete: 0.12, billingRatio: 1.02, startOffset: -45, baselineOffset: 330, slipDays: 0, overruns: {}, trend: "flat" },

  // Ironwood — the schedule story lives on The Harlow.
  { id: "iw-1188", companyId: "ironwood", number: "IW-1188", name: "The Harlow, 14-storey rental", client: "Harlow Residences LP", sector: "Multi-family", city: "Toronto", pm: "Nadia Petrova", superintendent: "Kevin O'Brien", contractValue: 38_500_000, originalMargin: 0.065, pctComplete: 0.64, billingRatio: 1.01, startOffset: -520, baselineOffset: 230, slipDays: 34, overruns: { "26 00 00": 0.04, "01 00 00": 0.06 }, trend: "slow_fade" },
  { id: "iw-1194", companyId: "ironwood", number: "IW-1194", name: "Danforth Mixed-use", client: "Danforth & Pape Developments", sector: "Mixed-use", city: "Toronto", pm: "Raj Mehta", superintendent: "Tomasz Nowak", contractValue: 21_000_000, originalMargin: 0.06, pctComplete: 0.41, billingRatio: 0.95, startOffset: -260, baselineOffset: 320, slipDays: 12, overruns: { "31 00 00": 0.18, "03 30 00": 0.05 }, trend: "fade" },
  { id: "iw-1201", companyId: "ironwood", number: "IW-1201", name: "Etobicoke Long-term Care Addition", client: "Lakeshore Seniors Care", sector: "Healthcare", city: "Toronto", pm: "Nadia Petrova", superintendent: "Ana Souza", contractValue: 26_400_000, originalMargin: 0.07, pctComplete: 0.28, billingRatio: 1.04, startOffset: -180, baselineOffset: 410, slipDays: 0, overruns: { "05 12 00": -0.03 }, trend: "flat" },
  { id: "iw-1172", companyId: "ironwood", number: "IW-1172", name: "Liberty Office Retrofit", client: "King West Office Trust", sector: "Office", city: "Toronto", pm: "Raj Mehta", superintendent: "Ana Souza", contractValue: 8_900_000, originalMargin: 0.075, pctComplete: 0.88, billingRatio: 1.02, startOffset: -330, baselineOffset: 45, slipDays: 5, ti: true, overruns: { "26 00 00": 0.02 }, trend: "flat" },
  { id: "iw-1207", companyId: "ironwood", number: "IW-1207", name: "Markham Secondary School Gym", client: "York North District School Board", sector: "Education", city: "Markham", pm: "Elena Rossi", superintendent: "Tomasz Nowak", contractValue: 6_200_000, originalMargin: 0.07, pctComplete: 0.09, billingRatio: 1.06, startOffset: -30, baselineOffset: 300, slipDays: 0, overruns: {}, trend: "flat" },

  // Cascade — the cash and compliance story.
  { id: "cc-431", companyId: "cascade", number: "CC-431", name: "Main Street Bakery-Café TI", client: "Fernwood Bakehouse", sector: "Retail", city: "Vancouver", pm: "Owen Park", superintendent: "Dev Gill", contractValue: 860_000, originalMargin: 0.12, pctComplete: 0.94, billingRatio: 0.92, startOffset: -95, baselineOffset: 8, slipDays: 4, ti: true, overruns: { "06 40 00": 0.07 }, trend: "slow_fade" },
  { id: "cc-436", companyId: "cascade", number: "CC-436", name: "Kitsilano Dental Clinic TI", client: "Bright Harbour Dental", sector: "Healthcare", city: "Vancouver", pm: "Owen Park", superintendent: "Dev Gill", contractValue: 1_450_000, originalMargin: 0.105, pctComplete: 0.68, billingRatio: 0.9, startOffset: -80, baselineOffset: 40, slipDays: 0, ti: true, overruns: { "22 00 00": 0.05 }, trend: "flat" },
  { id: "cc-440", companyId: "cascade", number: "CC-440", name: "Burnaby Office, Floors 8–9", client: "Metrotown Office Partners", sector: "Office", city: "Burnaby", pm: "Lena Fischer", superintendent: "Marcus Lee", contractValue: 3_900_000, originalMargin: 0.09, pctComplete: 0.46, billingRatio: 0.88, startOffset: -70, baselineOffset: 95, slipDays: 7, ti: true, overruns: { "09 20 00": 0.06, "23 00 00": 0.04 }, trend: "fade" },
  { id: "cc-442", companyId: "cascade", number: "CC-442", name: "Commercial Drive Restaurant", client: "Osteria Nonna Inc.", sector: "Retail", city: "Vancouver", pm: "Lena Fischer", superintendent: "Dev Gill", contractValue: 1_200_000, originalMargin: 0.11, pctComplete: 0.31, billingRatio: 1.02, startOffset: -40, baselineOffset: 85, slipDays: 0, ti: true, overruns: {}, trend: "flat" },
  { id: "cc-445", companyId: "cascade", number: "CC-445", name: "Richmond Warehouse Mezzanine", client: "Fraser Delta Distribution", sector: "Industrial", city: "Richmond", pm: "Owen Park", superintendent: "Marcus Lee", contractValue: 2_700_000, originalMargin: 0.085, pctComplete: 0.18, billingRatio: 1.0, startOffset: -30, baselineOffset: 130, slipDays: 0, ti: true, overruns: {}, trend: "flat" },
  { id: "cc-447", companyId: "cascade", number: "CC-447", name: "North Van Fitness Studio TI", client: "Tidewater Fitness", sector: "Retail", city: "North Vancouver", pm: "Lena Fischer", superintendent: "Marcus Lee", contractValue: 950_000, originalMargin: 0.1, pctComplete: 0.07, billingRatio: 1.0, startOffset: -12, baselineOffset: 75, slipDays: 0, ti: true, overruns: {}, trend: "flat" },
];

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function buildCostCodes(spec: ProjectSpec, originalBudget: number): CostCode[] {
  const tpl = spec.ti ? TI_CODES : BUILDING_CODES;
  return tpl.map((t) => {
    const budget = Math.round((originalBudget * t.weight) / 100) * 100;
    const progress = clamp01((spec.pctComplete - t.start) / t.span);
    const over = spec.overruns?.[t.code] ?? (noise(spec.id + t.code) - 0.5) * 0.012;
    const forecast = Math.round((budget * (1 + over)) / 100) * 100;
    // Subcontracts are let ahead of the work: anything starting within the next 25% of the job is bought out.
    const bought = spec.pctComplete + 0.25 >= t.start ? 1 : 0;
    const committed = Math.round((bought ? forecast * (0.86 + noise(spec.id + t.code + "c") * 0.1) : 0) / 100) * 100;
    const actual = Math.round((forecast * progress * (0.97 + noise(spec.id + t.code + "a") * 0.05)) / 100) * 100;
    return { code: t.code, name: t.name, budget, committed: Math.max(committed, actual), actual, forecast };
  });
}

/** 12 weekly points from the original margin to `now`, shaped by the spec's trend. */
function buildMarginHistory(spec: ProjectSpec, now: number): { week: string; margin: number }[] {
  const pts: { week: string; margin: number }[] = [];
  const start = spec.trend === "recover" ? now - 0.012 : spec.originalMargin;
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    let shape: number;
    if (spec.trend === "fade") shape = t < 0.45 ? t * 0.15 : 0.07 + Math.pow((t - 0.45) / 0.55, 1.6) * 0.93;
    else if (spec.trend === "slow_fade") shape = t;
    else if (spec.trend === "recover") shape = Math.sin((t * Math.PI) / 2);
    else shape = t;
    const jitter = i === 11 || i === 0 ? 0 : (noise(spec.id + "m" + i) - 0.5) * 0.002;
    pts.push({ week: d(-7 * (11 - i)), margin: Math.round((start + (now - start) * shape + jitter) * 10_000) / 10_000 });
  }
  return pts;
}

// ---------- change orders ----------
type CO = Omit<ChangeOrder, "raisedOn" | "id"> & { raisedAgo: number };
const co = (projectId: string, number: string, title: string, origin: ChangeOrderOrigin, status: ChangeOrderStatus, cost: number, value: number, raisedAgo: number, fieldStarted: boolean, reference?: string): CO => ({
  projectId,
  number,
  title,
  origin,
  status,
  cost,
  value,
  raisedAgo,
  fieldStarted,
  reference,
});

const CO_SPECS: CO[] = [
  // Riverside: five pieces of field-started work nobody has priced. This is the margin fade.
  co("sr-2207", "PCO-014", "Added lead-lined walls, imaging suite 2nd floor", "Owner request", "unpriced", 148_000, 171_000, 38, true, "RFI-087"),
  co("sr-2207", "PCO-016", "Medical gas outlet relocation, exam rooms 210–224", "Design change", "unpriced", 92_000, 108_000, 27, true, "ASI-011"),
  co("sr-2207", "PCO-017", "Rock removal at elevator pit", "Unforeseen condition", "pricing", 64_000, 76_000, 22, true, "RFI-091"),
  co("sr-2207", "PCO-019", "Upgraded nurse-call cabling to Cat6A", "Owner request", "unpriced", 58_000, 68_000, 15, true),
  co("sr-2207", "PCO-020", "Additional fire dampers, corridor 3", "Code requirement", "unpriced", 49_000, 57_000, 9, true, "RFI-095"),
  co("sr-2207", "CO-008", "Revised parkade lighting layout", "Design change", "submitted", 38_000, 46_000, 31, false),
  co("sr-2207", "CO-006", "Owner-requested canopy at main entrance", "Owner request", "approved", 112_000, 134_000, 74, false),
  co("sr-2207", "CO-004", "Winter heating and hoarding, Jan–Feb", "Unforeseen condition", "billed", 86_000, 98_000, 160, false),
  co("sr-2211", "CO-011", "Asbestos abatement, gym ceiling", "Unforeseen condition", "submitted", 71_000, 84_000, 18, true),
  co("sr-2211", "CO-009", "Additional data drops, library", "Owner request", "approved", 24_000, 29_000, 52, false),
  co("sr-2211", "CO-007", "Accessible washroom upgrade", "Code requirement", "billed", 46_000, 54_000, 110, false),
  co("sr-2302", "CO-005", "Glass boardroom front, level 6", "Owner request", "approved", 31_000, 39_000, 40, false),
  co("sr-2305", "PCO-004", "Soft soils, over-excavate and replace pad C", "Unforeseen condition", "pricing", 83_000, 97_000, 12, true, "Geotech memo 3"),
  co("sr-2305", "CO-002", "Storefront revisions, tenant B1", "Owner request", "submitted", 27_000, 33_000, 20, false),
  co("sr-2309", "CO-003", "Freezer floor insulation upgrade", "Design change", "submitted", 118_000, 139_000, 16, false, "ASI-004"),
  co("sr-2309", "PCO-005", "Utility relocation, north access road", "Unforeseen condition", "unpriced", 42_000, 49_000, 6, false),
  co("sr-2312", "CO-001", "Revised millwork, children's area", "Owner request", "submitted", 19_000, 23_000, 8, false),

  co("iw-1188", "CO-031", "Suite layout revisions, levels 11–14", "Owner request", "approved", 284_000, 321_000, 63, false),
  co("iw-1188", "PCO-044", "Winter concrete protection, levels 13–14", "Unforeseen condition", "pricing", 96_000, 109_000, 19, true),
  co("iw-1188", "PCO-046", "Additional hydro vault ventilation", "Code requirement", "unpriced", 41_000, 47_000, 11, true, "Toronto Hydro comment"),
  co("iw-1188", "CO-033", "Amenity rooftop pergola", "Owner request", "submitted", 77_000, 92_000, 26, false),
  co("iw-1194", "PCO-021", "Dewatering, east shoring wall", "Unforeseen condition", "unpriced", 214_000, 247_000, 33, true, "RFI-052"),
  co("iw-1194", "PCO-023", "Contaminated soil disposal, additional 640 t", "Unforeseen condition", "pricing", 128_000, 146_000, 24, true),
  co("iw-1194", "CO-014", "Retail frontage redesign", "Design change", "submitted", 63_000, 74_000, 29, false),
  co("iw-1194", "CO-012", "Added parking level EV rough-in", "Owner request", "approved", 156_000, 182_000, 81, false),
  co("iw-1201", "CO-006", "Resident lounge expansion", "Owner request", "approved", 94_000, 112_000, 47, false),
  co("iw-1201", "PCO-009", "Revised sprinkler density, storage", "Code requirement", "pricing", 22_000, 26_000, 10, false),
  co("iw-1172", "CO-019", "Lobby feature wall", "Owner request", "billed", 58_000, 69_000, 90, false),
  co("iw-1172", "CO-021", "Additional floor-box power, level 3", "Owner request", "submitted", 34_000, 40_000, 14, true),

  co("cc-431", "CO-003", "Upgraded display case power", "Owner request", "approved", 8_600, 10_400, 21, false),
  co("cc-436", "CO-002", "Additional operatory plumbing", "Owner request", "submitted", 18_400, 22_000, 17, true),
  co("cc-440", "PCO-006", "Concealed ductwork conflict, floor 9", "Unforeseen condition", "unpriced", 46_000, 54_000, 26, true, "RFI-019"),
  co("cc-440", "PCO-007", "Tenant-requested glass office fronts", "Owner request", "pricing", 61_000, 73_000, 13, true),
  co("cc-440", "CO-004", "Revised ceiling grid, open office", "Design change", "approved", 22_000, 27_000, 39, false),
  co("cc-442", "CO-001", "Hood exhaust upsizing", "Code requirement", "submitted", 26_000, 31_000, 9, false),
  co("cc-445", "PCO-002", "Rack anchorage engineering revisions", "Design change", "unpriced", 14_000, 17_000, 5, false),
];

// ---------- milestones ----------
const BUILDING_MILESTONES: [string, number, boolean][] = [
  ["Mobilization", 0.02, false],
  ["Foundations complete", 0.22, true],
  ["Structure topped out", 0.42, true],
  ["Building enclosed", 0.6, true],
  ["MEP rough-in complete", 0.74, true],
  ["Owner fit-out start", 0.86, false],
  ["Substantial completion", 1, true],
];
const TI_MILESTONES: [string, number, boolean][] = [
  ["Demolition complete", 0.12, false],
  ["Rough-in inspections passed", 0.45, true],
  ["Ceilings closed", 0.65, true],
  ["Millwork installed", 0.85, false],
  ["Substantial completion", 1, true],
];

function buildMilestones(spec: ProjectSpec): Milestone[] {
  const tpl = spec.ti ? TI_MILESTONES : BUILDING_MILESTONES;
  const span = spec.baselineOffset - spec.startOffset;
  return tpl.map(([name, at, critical], i) => {
    const baselineOff = Math.round(spec.startOffset + span * at);
    const done = spec.pctComplete >= at;
    // Slip ramps in for milestones still ahead of us; completed ones carry the slip they actually had.
    const slip = done ? Math.round(spec.slipDays * at * 0.5) : spec.slipDays;
    const forecastOff = baselineOff + slip;
    let status: MilestoneStatus = "on_track";
    if (done) status = "done";
    else if (forecastOff < 0) status = "late";
    else if (slip >= 7) status = "slipping";
    return { id: `${spec.id}-m${i}`, projectId: spec.id, name, baseline: d(baselineOff), forecast: d(forecastOff), status, critical };
  });
}

// ---------- procurement ----------
type PI = Omit<ProcurementItem, "id" | "needBy" | "expectedDelivery"> & { needBy: number; expected: number };
const pi = (projectId: string, item: string, supplier: string, leadWeeks: number, needBy: number, expected: number, status: ProcurementStatus): PI => ({ projectId, item, supplier, leadWeeks, needBy, expected, status });

const PROCUREMENT_SPECS: PI[] = [
  pi("sr-2207", "Imaging suite shielding panels", "Northern Radiation Supply", 10, 18, 25, "in_fabrication"),
  pi("sr-2207", "Rooftop air handling units (2)", "Engineered Air", 16, 34, 30, "in_fabrication"),
  pi("sr-2207", "Medical gas manifold", "Praxis Medical Systems", 8, 40, 38, "released"),
  pi("sr-2309", "Main switchgear, 2000A", "Eaton via Westburne", 32, 120, 151, "submittal_pending"),
  pi("sr-2309", "Ammonia refrigeration package", "Cimco Refrigeration", 28, 170, 166, "released"),
  pi("sr-2309", "Insulated metal panels", "Kingspan", 14, 72, 70, "released"),
  pi("sr-2305", "Storefront glazing, pad B", "Alumicor", 9, 58, 55, "released"),
  pi("sr-2312", "Glulam roof structure", "Western Archrib", 18, 110, 104, "submittal_pending"),

  pi("iw-1188", "Main electrical switchgear", "Schneider Electric", 40, 21, 55, "in_fabrication"),
  pi("iw-1188", "Passenger elevators (3)", "KONE", 36, 38, 44, "in_fabrication"),
  pi("iw-1188", "Suite appliances, 212 units", "Whirlpool Contract", 12, 96, 90, "released"),
  pi("iw-1194", "Unitized curtain wall", "Flynn Canada", 24, 140, 148, "submittal_pending"),
  pi("iw-1201", "Emergency generator, 800 kW", "Toromont Cat", 30, 210, 204, "released"),
  pi("iw-1172", "Lobby feature lighting", "Lumenpulse", 10, 20, 19, "shipped"),

  pi("cc-440", "VAV boxes, floor 9", "Trane", 8, 12, 19, "in_fabrication"),
  pi("cc-436", "Dental chairs and delivery units", "Henry Schein", 10, 22, 21, "shipped"),
  pi("cc-442", "Kitchen hood and fire suppression", "Halton", 9, 41, 40, "released"),
  pi("cc-445", "Mezzanine steel package", "Supreme Steel", 7, 30, 30, "submittal_pending"),
];

// ---------- subcontractors ----------
type SubSpec = Omit<Subcontractor, "wcbExpiry" | "insuranceExpiry" | "payApp"> & {
  wcb: number;
  ins: number;
  payApp: { amount: number; status: Subcontractor["payApp"]["status"]; receivedAgo?: number };
};
const sub = (id: string, companyId: string, name: string, trade: string, projectIds: string[], contractValue: number, billedRatio: number, payApp: SubSpec["payApp"], wcb: number, ins: number, lienWaiver: "current" | "missing" = "current"): SubSpec => ({
  id,
  companyId,
  name,
  trade,
  projectIds,
  contractValue,
  billedToDate: Math.round((contractValue * billedRatio) / 100) * 100,
  payApp,
  wcb,
  ins,
  lienWaiver,
});

const SUB_SPECS: SubSpec[] = [
  sub("sr-s1", "summit-ridge", "Bow River Electric", "Electrical", ["sr-2207", "sr-2211"], 2_840_000, 0.54, { amount: 186_400, status: "under_review", receivedAgo: 4 }, 140, 210),
  sub("sr-s2", "summit-ridge", "Chinook Mechanical", "HVAC and plumbing", ["sr-2207", "sr-2309"], 3_610_000, 0.41, { amount: 241_900, status: "received", receivedAgo: 2 }, 95, 12),
  sub("sr-s3", "summit-ridge", "Stampede Drywall & Acoustics", "Drywall and framing", ["sr-2207", "sr-2302"], 1_420_000, 0.62, { amount: 98_700, status: "approved", receivedAgo: 9 }, 60, 160),
  sub("sr-s4", "summit-ridge", "Prairie Formwork Ltd.", "Concrete", ["sr-2305", "sr-2312"], 1_180_000, 0.33, { amount: 132_000, status: "received", receivedAgo: 1 }, -3, 120, "missing"),
  sub("sr-s5", "summit-ridge", "Glenmore Glass", "Curtain wall and glazing", ["sr-2207"], 960_000, 0.28, { amount: 0, status: "not_received" }, 210, 300),
  sub("sr-s6", "summit-ridge", "Elbow Valley Excavating", "Earthwork", ["sr-2305", "sr-2309", "sr-2312"], 840_000, 0.71, { amount: 64_300, status: "paid", receivedAgo: 21 }, 180, 45),

  sub("iw-s1", "ironwood", "Volta Electrical Contractors", "Electrical", ["iw-1188", "iw-1172"], 5_920_000, 0.6, { amount: 412_000, status: "under_review", receivedAgo: 6 }, 120, 200),
  sub("iw-s2", "ironwood", "Lakeshore HVAC", "HVAC", ["iw-1188", "iw-1201"], 6_400_000, 0.47, { amount: 388_500, status: "received", receivedAgo: 3 }, 75, 150),
  sub("iw-s3", "ironwood", "Don Valley Forming", "Concrete", ["iw-1188", "iw-1194", "iw-1201"], 8_150_000, 0.66, { amount: 604_200, status: "approved", receivedAgo: 10 }, 40, 9),
  sub("iw-s4", "ironwood", "Humber Shoring & Dewatering", "Shoring and dewatering", ["iw-1194"], 1_310_000, 0.82, { amount: 171_000, status: "under_review", receivedAgo: 12 }, 160, 240),
  sub("iw-s5", "ironwood", "Scarborough Drywall Systems", "Drywall and framing", ["iw-1188", "iw-1172"], 3_480_000, 0.52, { amount: 226_000, status: "received", receivedAgo: 2 }, 22, 180),
  sub("iw-s6", "ironwood", "Northern Lift Elevators", "Elevators", ["iw-1188"], 1_640_000, 0.35, { amount: 0, status: "not_received" }, 300, 330),

  sub("cc-s1", "cascade", "Coastline Electric", "Electrical", ["cc-436", "cc-440", "cc-442"], 712_000, 0.44, { amount: 58_200, status: "received", receivedAgo: 5 }, 110, 180),
  sub("cc-s2", "cascade", "Fraser Mechanical", "HVAC and plumbing", ["cc-436", "cc-440", "cc-445"], 884_000, 0.39, { amount: 71_400, status: "under_review", receivedAgo: 8 }, -6, 90),
  sub("cc-s3", "cascade", "Granville Millwork", "Millwork", ["cc-431", "cc-436"], 248_000, 0.81, { amount: 32_600, status: "approved", receivedAgo: 11 }, 130, 25),
  sub("cc-s4", "cascade", "Pacific Interiors", "Drywall and ceilings", ["cc-440", "cc-442", "cc-447"], 596_000, 0.37, { amount: 48_900, status: "received", receivedAgo: 3 }, 70, 140, "missing"),
  sub("cc-s5", "cascade", "Seawall Flooring", "Flooring", ["cc-431", "cc-436"], 142_000, 0.6, { amount: 21_300, status: "paid", receivedAgo: 18 }, 200, 210),
];

// ---------- integrations ----------
type IntegrationSpec = Omit<Integration, "state" | "lastSyncAt"> & { connectedFor: string[] };
const INTEGRATION_SPECS: IntegrationSpec[] = [
  { id: "procore", name: "Procore", area: "project_management", description: "Budgets, commitments, change events, RFIs, daily logs and schedule.", connectedFor: ["summit-ridge", "cascade"] },
  { id: "autodesk-build", name: "Autodesk Build", area: "project_management", description: "Cost management, change orders, submittals and field issues.", connectedFor: ["ironwood"] },
  { id: "sage-300-cre", name: "Sage 300 CRE", area: "accounting", description: "Job cost, AP, AR, progress billing and holdback.", connectedFor: ["summit-ridge"] },
  { id: "jonas-premier", name: "Jonas Premier", area: "accounting", description: "Job cost, subcontract payables and WIP.", connectedFor: ["ironwood"] },
  { id: "quickbooks", name: "QuickBooks Online", area: "accounting", description: "Bills, invoices and job profitability by class.", connectedFor: ["cascade"] },
  { id: "foundation", name: "Foundation Software", area: "accounting", description: "Construction accounting, certified payroll and WIP.", connectedFor: [] },
  { id: "procore-estimating", name: "Procore Estimating", area: "estimating", description: "Bid packages and estimates, to price change orders from the original takeoff.", connectedFor: [] },
  { id: "bluebeam", name: "Bluebeam", area: "documents", description: "Drawing markups and quantity takeoffs for change pricing.", connectedFor: ["summit-ridge"] },
  { id: "autodesk-docs", name: "Autodesk Docs", area: "documents", description: "Drawings, ASIs and revisions.", connectedFor: ["ironwood"] },
  { id: "raken", name: "Raken", area: "field", description: "Daily reports, crew hours and production quantities.", connectedFor: [] },
  { id: "busybusy", name: "busybusy", area: "field", description: "GPS time tracking by cost code.", connectedFor: [] },
  { id: "p6", name: "Oracle Primavera P6", area: "project_management", description: "CPM schedules, float and critical path.", connectedFor: [] },
  { id: "whatsapp", name: "WhatsApp", area: "messaging", description: "The morning brief and urgent alerts, on your phone.", connectedFor: ["summit-ridge", "ironwood", "cascade"] },
  { id: "teams", name: "Microsoft Teams", area: "messaging", description: "Post briefs and approvals to a project channel.", connectedFor: [] },
];
const COMING_SOON = new Set(["foundation", "p6", "busybusy"]);

// ---------- assembled world ----------
export interface World {
  projects: Project[];
  changeOrders: ChangeOrder[];
  milestones: Milestone[];
  procurement: ProcurementItem[];
  subs: Subcontractor[];
  integrations: Record<string, Integration[]>;
}

function build(): World {
  const changeOrders: ChangeOrder[] = CO_SPECS.map((c, i) => {
    const { raisedAgo, ...rest } = c;
    return { ...rest, id: `co-${i}`, raisedOn: d(-raisedAgo) };
  });

  const projects: Project[] = PROJECT_SPECS.map((s) => {
    const originalBudget = Math.round(s.contractValue * (1 - s.originalMargin));
    const costCodes = buildCostCodes(s, originalBudget);
    const earnedRevenue = s.contractValue * s.pctComplete;
    const project: Project = {
      id: s.id,
      companyId: s.companyId,
      number: s.number,
      name: s.name,
      client: s.client,
      sector: s.sector,
      city: s.city,
      pm: s.pm,
      superintendent: s.superintendent,
      contractValue: s.contractValue,
      originalBudget,
      pctComplete: s.pctComplete,
      billedToDate: Math.round((earnedRevenue * s.billingRatio) / 100) * 100,
      startDate: d(s.startOffset),
      baselineCompletion: d(s.baselineOffset),
      forecastCompletion: d(s.baselineOffset + s.slipDays),
      costCodes,
      marginHistory: [],
    };
    return project;
  });

  return {
    projects,
    changeOrders,
    milestones: PROJECT_SPECS.flatMap(buildMilestones),
    procurement: PROCUREMENT_SPECS.map((p, i) => {
      const { needBy, expected, ...rest } = p;
      return { ...rest, id: `pi-${i}`, needBy: d(needBy), expectedDelivery: d(expected) };
    }),
    subs: SUB_SPECS.map((s) => {
      const { wcb, ins, payApp, ...rest } = s;
      return {
        ...rest,
        wcbExpiry: d(wcb),
        insuranceExpiry: d(ins),
        payApp: { period: d(-6).slice(0, 7), amount: payApp.amount, status: payApp.status, receivedOn: payApp.receivedAgo !== undefined ? d(-payApp.receivedAgo) : undefined },
      };
    }),
    integrations: Object.fromEntries(
      COMPANIES.map((c) => [
        c.id,
        INTEGRATION_SPECS.map(({ connectedFor, ...i }) => ({
          ...i,
          state: connectedFor.includes(c.id) ? "connected" : COMING_SOON.has(i.id) ? "coming_soon" : "available",
          lastSyncAt: connectedFor.includes(c.id) ? `${TODAY}T11:${String(38 + (hash(i.id) % 6)).padStart(2, "0")}:00Z` : undefined,
        })) as Integration[],
      ]),
    ),
  };
}

export const WORLD: World = build();

/** Fills margin history once forecast margins are known (core.ts computes them). */
export function attachMarginHistory(project: Project, forecastMargin: number): Project {
  if (project.marginHistory.length) return project;
  const spec = PROJECT_SPECS.find((s) => s.id === project.id)!;
  project.marginHistory = buildMarginHistory(spec, forecastMargin);
  return project;
}

export function originalMarginOf(projectId: string): number {
  return PROJECT_SPECS.find((s) => s.id === projectId)!.originalMargin;
}
