import type { ChangeOrder, Commitment, CostCode, CostDay, Equipment, FieldTicket, Invoice, Job, SafetyEvent, TicketStatus } from "@evolv/contracts/types";
import { addDays, daysBetween, weekday } from "@evolv/contracts/dates";
import { evmSeries } from "@evolv/contracts/evm";
import { Rng, hashSeed } from "./rng";
import type { JobKind, JobSpec } from "./world";

const round = (v: number, step = 1) => Math.round(v / step) * step;
const isWorkday = (date: string) => weekday(date) >= 1 && weekday(date) <= 5;

const TICKET_PREFIX: Record<string, string> = {
  "foothills-pipeline": "FP",
  "peace-river-oilfield": "PR",
  "red-deer-lease": "RD",
  "bow-river-facilities": "BR",
};

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

const BILLING_PERIOD_DAYS = 14;

/** Progress invoices on a 14-day cycle, each for the work earned since the last one. */
export function generateInvoices(spec: JobSpec, job: Job, codes: CostCode[], days: CostDay[], asOf: string): Invoice[] {
  const dates: string[] = [];
  for (let d = job.startDate; d <= asOf; d = addDays(d, 1)) dates.push(d);
  const series = evmSeries(job, codes, days, dates);
  const bac = codes.reduce((a, c) => a + c.budget, 0);
  const pctAt = (date: string) => {
    const p = series[daysBetween(job.startDate, date)];
    return p && bac > 0 ? p.ev / bac : 0;
  };

  const ends: string[] = [];
  for (let p = addDays(job.startDate, BILLING_PERIOD_DAYS); p <= addDays(asOf, -4); p = addDays(p, BILLING_PERIOD_DAYS)) ends.push(p);

  const invoices: Invoice[] = [];
  let billedTo = 0;
  ends.forEach((periodEnd, i) => {
    const target = job.contractValue * pctAt(periodEnd);
    const amount = round(target - billedTo, 100);
    billedTo += amount;
    const isLast = i === ends.length - 1;
    const isOverdueOne = spec.overdueInvoice && i === ends.length - 2;
    const number = `INV-${spec.id.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, "0")}`;
    const id = `${spec.id}:inv-${i + 1}`;

    if (isLast && spec.billingLag) {
      invoices.push({ id, jobId: spec.id, number, periodEnd, amount, status: "draft" });
      return;
    }
    const issuedAt = addDays(periodEnd, 3);
    const terms = isOverdueOne ? 10 : 30;
    const dueDate = addDays(issuedAt, terms);
    const paid = dueDate < addDays(asOf, -3) && !isOverdueOne;
    invoices.push({
      id,
      jobId: spec.id,
      number,
      periodEnd,
      amount,
      status: paid ? "paid" : isOverdueOne || dueDate < asOf ? "overdue" : "issued",
      issuedAt,
      dueDate,
      paidAt: paid ? addDays(dueDate, -2) : undefined,
    });
  });
  return invoices;
}

// ---------------------------------------------------------------------------
// Change orders
// ---------------------------------------------------------------------------

const HISTORIC_CO: Record<string, { title: string; amount: number; status: ChangeOrder["status"]; agoDays: number }[]> = {
  "ridge-loop": [{ title: "Additional creek crossing: wet bore", amount: 48_500, status: "approved", agoDays: 41 }],
  "hwy22-bore": [{ title: "Frac-out containment upgrade", amount: 18_200, status: "approved", agoDays: 30 }],
  "pad-14-22": [{ title: "Winter heat trace on tanks", amount: 22_000, status: "approved", agoDays: 35 }],
  "strathmore-battery": [
    { title: "Added inlet separator tie-in", amount: 96_000, status: "approved", agoDays: 38 },
    { title: "Revised anchor bolt pattern", amount: 12_400, status: "rejected", agoDays: 22 },
  ],
  "brooks-compressor": [{ title: "Relocated knock-out drum skid", amount: 41_800, status: "pending", agoDays: 9 }],
};

export function generateChangeOrders(spec: JobSpec, asOf: string): ChangeOrder[] {
  return (HISTORIC_CO[spec.id] ?? []).map((c, i) => ({
    id: `${spec.id}:co-${i + 1}`,
    jobId: spec.id,
    number: `CO-${String(i + 1).padStart(3, "0")}`,
    title: c.title,
    amount: c.amount,
    status: c.status,
    createdAt: `${addDays(asOf, -c.agoDays)}T15:00:00-06:00`,
    submittedAt: c.status === "draft" ? undefined : `${addDays(asOf, -c.agoDays + 1)}T10:00:00-06:00`,
  }));
}

// ---------------------------------------------------------------------------
// Field tickets
// ---------------------------------------------------------------------------

const TICKET_TEXT: Record<JobKind, string[]> = {
  service: ["Hot oil treatment on flowline", "Vac truck: tank cleanout", "Dig and expose: integrity bell hole", "Lease maintenance and brushing", "Fluid haul, 3 loads", "Wellsite swabbing support"],
  pipeline: ["T&M: standby for client inspector", "T&M: locate and expose foreign crossing", "T&M: dewatering at crossing"],
  facility: ["T&M: scaffold alterations", "T&M: hot work permit standby", "T&M: crane standby, weather"],
  lease: ["T&M: standby for survey", "T&M: lease repair after rain", "T&M: extra culvert bedding"],
};

interface TicketPlant {
  open: number;
  signedStuck: number;
  disputed: number;
}

const TICKET_PLANTS: Record<string, TicketPlant> = {
  "pad-14-22": { open: 6, signedStuck: 4, disputed: 2 },
};

export function generateTickets(spec: JobSpec, asOf: string): FieldTicket[] {
  const rng = new Rng(hashSeed(`tickets:${spec.id}`));
  const perDay = spec.kind === "service" ? 3 : 0.45;
  const prefix = TICKET_PREFIX[spec.companyId];
  const texts = TICKET_TEXT[spec.kind];
  const plant = TICKET_PLANTS[spec.id];
  const out: FieldTicket[] = [];
  let seq = 1000 + Math.floor(rng.range(0, 800));

  const base = (date: string, status: TicketStatus): FieldTicket => {
    const labourHours = round(spec.kind === "service" ? rng.range(10, 44) : rng.range(8, 30), 0.5);
    const equipmentHours = round(spec.kind === "service" ? rng.range(6, 24) : rng.range(4, 14), 0.5);
    const amount = round(labourHours * 96 + equipmentHours * 165 + (spec.kind === "service" ? rng.range(300, 2400) : 0), 5);
    seq += 1;
    const signed = status !== "open";
    return {
      id: `${spec.id}:ft-${seq}`,
      companyId: spec.companyId,
      jobId: spec.id,
      number: `${prefix}-${seq}`,
      date,
      crew: `Crew ${rng.int(1, spec.kind === "service" ? 6 : 3)}`,
      description: rng.pick(texts),
      labourHours,
      equipmentHours,
      amount,
      status,
      signedAt: signed ? `${date}T17:30:00-06:00` : undefined,
      submittedAt: ["submitted", "approved", "paid"].includes(status) ? `${addDays(date, 2)}T09:00:00-06:00` : undefined,
    };
  };

  for (let age = 34; age >= 0; age--) {
    const date = addDays(asOf, -age);
    if (!isWorkday(date)) continue;
    const n = Math.floor(perDay) + (rng.chance(perDay - Math.floor(perDay)) ? 1 : 0);
    for (let i = 0; i < n; i++) {
      let status: TicketStatus;
      if (age >= 24) status = "paid";
      else if (age >= 12) status = rng.chance(0.5) ? "paid" : "approved";
      else if (age >= 5) status = "submitted";
      else if (age >= 3) status = "signed";
      else status = "open";
      out.push(base(date, status));
    }
  }

  if (plant) {
    // Re-status some existing tickets in the leak windows so the story is real data, not extra rows.
    const pick = (from: number, to: number, n: number, status: TicketStatus, reason?: string) => {
      const pool = out.filter((t) => {
        const age = daysBetween(t.date, asOf);
        return age >= from && age <= to && t.status !== "open" && !["disputed"].includes(t.status);
      });
      for (const t of rng.shuffle(pool).slice(0, n)) {
        t.status = status;
        t.submittedAt = undefined;
        t.signedAt = status === "open" ? undefined : t.signedAt;
        t.disputeReason = reason;
      }
    };
    pick(4, 9, plant.open, "open");
    pick(6, 13, plant.signedStuck, "signed");
    pick(15, 20, plant.disputed, "disputed", "Client disputes hours: no lease access log to match the ticket.");
  }
  return out;
}

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

interface EquipSpec {
  name: string;
  type: string;
  ownership: Equipment["ownership"];
  dailyRate: number;
  /** "busy" (8-10 h workdays), "idle-week" (busy then unused for the last N days), or "part" (about half-time). */
  pattern: "busy" | "part" | { idleLast: number };
  serviceInDays?: number;
}

const EQUIPMENT: Record<string, EquipSpec[]> = {
  "ridge-loop": [
    { name: "Komatsu PC360 excavator", type: "excavator", ownership: "owned", dailyRate: 1_350, pattern: "busy", serviceInDays: 4 },
    { name: "CAT D6 dozer", type: "dozer", ownership: "owned", dailyRate: 1_150, pattern: "busy" },
    { name: "Hydrovac HV-3", type: "hydrovac", ownership: "rented", dailyRate: 1_900, pattern: "part" },
  ],
  "kootenay-pad": [
    { name: "CAT 320 excavator", type: "excavator", ownership: "owned", dailyRate: 980, pattern: "busy" },
    { name: "Vibratory compactor", type: "compactor", ownership: "rented", dailyRate: 420, pattern: "part" },
  ],
  "hwy22-bore": [{ name: "Directional drill rig", type: "hdd", ownership: "rented", dailyRate: 3_200, pattern: "busy" }],
  "pad-14-22": [
    { name: "Vac truck VT-209", type: "vac truck", ownership: "rented", dailyRate: 1_450, pattern: { idleLast: 7 } },
    { name: "Hot oiler HO-12", type: "hot oiler", ownership: "owned", dailyRate: 1_100, pattern: "busy" },
    { name: "Vac truck VT-114", type: "vac truck", ownership: "owned", dailyRate: 1_200, pattern: "busy" },
  ],
  "two-hills-reclaim": [{ name: "CAT 308 mini excavator", type: "excavator", ownership: "owned", dailyRate: 640, pattern: "part" }],
  "swan-hills-dig": [
    { name: "Hydrovac HV-7", type: "hydrovac", ownership: "owned", dailyRate: 1_800, pattern: "busy" },
    { name: "Deere 210 excavator", type: "excavator", ownership: "owned", dailyRate: 1_050, pattern: "busy" },
  ],
  "joffre-lease": [
    { name: "CAT 140 motor grader", type: "grader", ownership: "owned", dailyRate: 1_250, pattern: "busy" },
    { name: "Tandem gravel trucks (x4)", type: "truck", ownership: "rented", dailyRate: 2_400, pattern: "busy" },
  ],
  "pembina-tie-in": [{ name: "Sideboom CAT 572", type: "sideboom", ownership: "owned", dailyRate: 1_300, pattern: "busy", serviceInDays: 20 }],
  "sundre-road": [{ name: "CAT 140 motor grader", type: "grader", ownership: "owned", dailyRate: 1_250, pattern: "part" }],
  "strathmore-battery": [
    { name: "CAT 336 excavator", type: "excavator", ownership: "rented", dailyRate: 1_600, pattern: { idleLast: 6 } },
    { name: "Grove 90-tonne crane", type: "crane", ownership: "rented", dailyRate: 4_800, pattern: "part" },
    { name: "Manlift JLG 600S", type: "manlift", ownership: "rented", dailyRate: 380, pattern: "busy" },
  ],
  "brooks-compressor": [{ name: "Grove 60-tonne crane", type: "crane", ownership: "rented", dailyRate: 3_600, pattern: "busy" }],
  "bassano-meter": [{ name: "CAT 313 excavator", type: "excavator", ownership: "owned", dailyRate: 900, pattern: "busy" }],
};

export function generateEquipment(spec: JobSpec, asOf: string): Equipment[] {
  const rng = new Rng(hashSeed(`equip:${spec.id}`));
  return (EQUIPMENT[spec.id] ?? []).map((e, i) => {
    const usage: number[] = [];
    for (let k = 13; k >= 0; k--) {
      const date = addDays(asOf, -k);
      const work = isWorkday(date);
      if (typeof e.pattern === "object") {
        usage.push(k < e.pattern.idleLast ? 0 : work ? round(rng.range(7.5, 10), 0.5) : 0);
      } else if (e.pattern === "busy") {
        usage.push(work ? round(rng.range(8, 10.5), 0.5) : rng.chance(0.2) ? round(rng.range(2, 6), 0.5) : 0);
      } else {
        usage.push(work ? round(rng.range(2, 7), 0.5) : 0);
      }
    }
    return {
      id: `${spec.id}:eq-${i + 1}`,
      jobId: spec.id,
      name: e.name,
      type: e.type,
      ownership: e.ownership,
      dailyRate: e.dailyRate,
      usageHours14: usage,
      serviceDueDate: e.serviceInDays !== undefined ? addDays(asOf, e.serviceInDays) : undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Commitments (POs and subcontracts)
// ---------------------------------------------------------------------------

interface CommitSpec {
  vendor: string;
  description: string;
  kind: Commitment["kind"];
  committed: number;
  invoicedPct: number;
  promisedIn: number;
  needIn: number;
  status?: Commitment["status"];
}

const COMMITMENTS: Record<string, CommitSpec[]> = {
  "ridge-loop": [
    { vendor: "Northern Tube & Pipe", description: "12-inch X65 line pipe, 2.2 km", kind: "po", committed: 612_000, invoicedPct: 0.45, promisedIn: 17, needIn: 8 },
    { vendor: "Cascade Coating Services", description: "Field joint coating and NDE", kind: "subcontract", committed: 248_000, invoicedPct: 0.3, promisedIn: 6, needIn: 9 },
  ],
  "kootenay-pad": [{ vendor: "Prairie Valve & Fitting", description: "Suction and discharge valve package", kind: "po", committed: 188_000, invoicedPct: 0.5, promisedIn: 9, needIn: 20 }],
  "hwy22-bore": [{ vendor: "Directional Drilling Supply", description: "Reamers and drilling fluid", kind: "po", committed: 74_000, invoicedPct: 0.8, promisedIn: -3, needIn: -1, status: "delivered" }],
  "pad-14-22": [{ vendor: "Clearwater Fluids", description: "Treatment chemicals, term supply", kind: "po", committed: 164_000, invoicedPct: 0.62, promisedIn: 5, needIn: 7 }],
  "two-hills-reclaim": [{ vendor: "Alberta Native Seed", description: "Native seed mix, 40 ha", kind: "po", committed: 56_000, invoicedPct: 0.2, promisedIn: 12, needIn: 24 }],
  "swan-hills-dig": [{ vendor: "Boreal Disposal", description: "Hydrovac slurry disposal", kind: "subcontract", committed: 138_000, invoicedPct: 0.55, promisedIn: 4, needIn: 6 }],
  "joffre-lease": [
    { vendor: "Prairie Culvert & Steel", description: "CSP culvert package, 1200 mm", kind: "po", committed: 184_000, invoicedPct: 0.25, promisedIn: 14, needIn: 9 },
    { vendor: "Alberta Aggregate Supply", description: "Road gravel, 6,400 m3", kind: "po", committed: 372_000, invoicedPct: 0.5, promisedIn: 3, needIn: 5 },
  ],
  "pembina-tie-in": [{ vendor: "Prairie Valve & Fitting", description: "Tie-in valve assemblies", kind: "po", committed: 96_000, invoicedPct: 0.6, promisedIn: 4, needIn: 10 }],
  "sundre-road": [{ vendor: "Foothills Aggregates", description: "Crushed gravel, 5,100 m3", kind: "po", committed: 296_000, invoicedPct: 0.6, promisedIn: 2, needIn: 4 }],
  "strathmore-battery": [
    { vendor: "Summit Process Fabrication", description: "Inlet separator package", kind: "po", committed: 1_240_000, invoicedPct: 0.7, promisedIn: 8, needIn: 14 },
    { vendor: "Ironwood Electrical", description: "Electrical and instrumentation scope", kind: "subcontract", committed: 820_000, invoicedPct: 0.35, promisedIn: 30, needIn: 34 },
  ],
  "brooks-compressor": [{ vendor: "Summit Process Fabrication", description: "Knock-out drum skid", kind: "po", committed: 480_000, invoicedPct: 0.6, promisedIn: 10, needIn: 18 }],
  "bassano-meter": [{ vendor: "Meridian Measurement", description: "Ultrasonic meter run", kind: "po", committed: 142_000, invoicedPct: 0.5, promisedIn: 6, needIn: 12 }],
};

export function generateCommitments(spec: JobSpec, asOf: string): Commitment[] {
  return (COMMITMENTS[spec.id] ?? []).map((c, i) => ({
    id: `${spec.id}:po-${i + 1}`,
    jobId: spec.id,
    vendor: c.vendor,
    description: c.description,
    kind: c.kind,
    committed: c.committed,
    invoiced: round(c.committed * c.invoicedPct, 100),
    promisedDate: addDays(asOf, c.promisedIn),
    needDate: addDays(asOf, c.needIn),
    status: c.status ?? "open",
  }));
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

interface SafetySpec {
  kind: SafetyEvent["kind"];
  title: string;
  owner: string;
  raisedAgo: number;
  dueIn: number;
  status: SafetyEvent["status"];
}

const SAFETY: Record<string, SafetySpec[]> = {
  "ridge-loop": [{ kind: "near_miss", title: "Trench wall slough near excavator swing radius", owner: "Superintendent", raisedAgo: 19, dueIn: -9, status: "closed" }],
  "pad-14-22": [{ kind: "incident", title: "Hand injury at hose coupling (first aid only)", owner: "Crew foreman", raisedAgo: 25, dueIn: -15, status: "closed" }],
  "joffre-lease": [
    { kind: "inspection_finding", title: "Culvert excavation not benched or sloped", owner: "Superintendent", raisedAgo: 15, dueIn: -7, status: "open" },
    { kind: "near_miss", title: "Haul truck backed toward spotter", owner: "Crew foreman", raisedAgo: 6, dueIn: 4, status: "open" },
  ],
  "strathmore-battery": [{ kind: "inspection_finding", title: "Guardrail gap at pipe rack level 2", owner: "Site safety lead", raisedAgo: 5, dueIn: 5, status: "open" }],
  "brooks-compressor": [{ kind: "near_miss", title: "Unsecured load during crane pick", owner: "Superintendent", raisedAgo: 12, dueIn: -2, status: "closed" }],
};

export function generateSafety(spec: JobSpec, asOf: string): SafetyEvent[] {
  return (SAFETY[spec.id] ?? []).map((s, i) => ({
    id: `${spec.id}:sf-${i + 1}`,
    jobId: spec.id,
    kind: s.kind,
    date: addDays(asOf, -s.raisedAgo),
    title: s.title,
    owner: s.owner,
    correctiveDue: addDays(asOf, s.dueIn),
    status: s.status,
  }));
}
