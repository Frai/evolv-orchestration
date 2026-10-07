import type { CostCode, CostDay, Job } from "@evolv/contracts/types";
import { addDays, daysBetween, weekday } from "@evolv/contracts/dates";
import { Rng, hashSeed } from "./rng";
import { CODE_TEMPLATES, type Drift, type JobSpec } from "./world";

export interface JobCost {
  job: Job;
  codes: CostCode[];
  days: CostDay[];
}

const isWorkday = (date: string) => {
  const wd = weekday(date);
  return wd >= 1 && wd <= 5;
};

const workdaysBetween = (from: string, to: string) => {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (isWorkday(d)) n++;
  return Math.max(1, n);
};

/** Drift factor in force `daysAgo` days before the as-of date; 1 when none applies. */
function driftFor(drifts: Drift[] | undefined, code: string, daysAgo: number): number {
  const hit = drifts?.find((d) => d.code === code && daysAgo <= d.from);
  return hit ? hit.factor : 1;
}

const round = (v: number, step = 1) => Number((Math.round(v / step) * step).toFixed(2));

export function generateJobCost(spec: JobSpec, asOf: string): JobCost {
  const startDate = addDays(asOf, -spec.startedAgo);
  const endDate = addDays(startDate, spec.durationDays);
  const job: Job = {
    id: spec.id,
    companyId: spec.companyId,
    name: spec.name,
    client: spec.client,
    contractValue: spec.contractValue,
    startDate,
    endDate,
    status: "active",
    pm: spec.pm,
  };

  const bac = spec.contractValue * spec.bacRatio;
  const specs = CODE_TEMPLATES[spec.kind];
  const codes: CostCode[] = specs.map((s) => {
    const budget = round(bac * s.share, 100);
    const startOffset = Math.floor(s.start * spec.durationDays);
    const endOffset = Math.max(Math.floor(s.end * spec.durationDays), startOffset + 3);
    return {
      id: `${spec.id}:${s.code}`,
      jobId: spec.id,
      code: s.code,
      name: s.name,
      category: s.category,
      budget,
      plannedQty: Math.max(1, Math.round(budget / s.unitCost)),
      unit: s.unit,
      plannedStart: addDays(startDate, startOffset),
      plannedEnd: addDays(startDate, endOffset),
    };
  });
  if (spec.extra) {
    codes.push({
      id: `${spec.id}:${spec.extra.code}`,
      jobId: spec.id,
      code: spec.extra.code,
      name: spec.extra.name,
      category: "labour",
      budget: 0,
      plannedQty: 0,
      unit: "hr",
      plannedStart: addDays(asOf, -spec.extra.startedAgo),
      plannedEnd: addDays(asOf, -spec.extra.startedAgo + spec.extra.days),
      extra: true,
    });
  }

  const rng = new Rng(hashSeed(`cost:${spec.id}`));
  const days: CostDay[] = [];
  const cumQty = new Map<string, number>();
  const windowDays = new Map(codes.map((c) => [c.id, workdaysBetween(c.plannedStart, c.plannedEnd)]));
  const hourly = new Map(specs.map((s) => [`${spec.id}:${s.code}`, s.hourlyCost]));

  for (let date = startDate; date <= asOf; date = addDays(date, 1)) {
    if (!isWorkday(date)) continue;
    const daysAgo = daysBetween(date, asOf);
    for (const code of codes) {
      if (code.extra) continue;
      if (date < code.plannedStart) continue;
      const done = cumQty.get(code.id) ?? 0;
      const remaining = code.plannedQty - done;
      if (remaining <= 0.001) continue;

      const spiFactor = driftFor(spec.spiDrifts, code.code, daysAgo);
      const cpiFactor = spec.baseCpi * driftFor(spec.cpiDrifts, code.code, daysAgo) * rng.noise(0.035);
      const qty = Math.min(remaining, (code.plannedQty / windowDays.get(code.id)!) * spiFactor * rng.noise(0.1));
      const cost = (qty * (code.budget / code.plannedQty)) / cpiFactor;
      cumQty.set(code.id, done + qty);

      const rate = hourly.get(code.id);
      let hours = 0;
      let overtimeHours = 0;
      if (rate) {
        hours = cost / rate;
        const share = (daysAgo <= 10 ? spec.overtime.recent : spec.overtime.normal) * rng.noise(0.12);
        overtimeHours = hours * Math.min(0.6, Math.max(0, share));
      }
      days.push({
        jobId: spec.id,
        codeId: code.id,
        date,
        hours: round(hours, 0.1),
        overtimeHours: round(overtimeHours, 0.1),
        cost: round(cost),
        qty: round(qty, 0.01),
      });
    }

    if (spec.extra) {
      const first = addDays(asOf, -spec.extra.startedAgo);
      const workdaysSinceStart = workdaysBetween(first, date);
      if (date >= first && workdaysSinceStart <= spec.extra.days) {
        const noise = rng.noise(0.06);
        days.push({
          jobId: spec.id,
          codeId: `${spec.id}:${spec.extra.code}`,
          date,
          hours: round(spec.extra.dailyHours * noise, 0.1),
          overtimeHours: round(spec.extra.dailyHours * noise * 0.2, 0.1),
          cost: round(spec.extra.dailyCost * noise),
          qty: 0,
        });
      }
    }
  }

  return { job, codes, days };
}
