/**
 * Local-inspection convenience only: dumps the deterministic fixture set to JSON and prints a summary.
 * `npm run fixtures` regenerates /src/fixtures/data. The real data source is Postgres
 * (see scripts/seed-supabase.ts, which shares the same gen/build.ts pipeline).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { jobEvm } from "@evolv/contracts/evm";
import { index, money, pct } from "@evolv/contracts/format";
import { buildFixtureSet } from "./gen/build";

const OUT = join(__dirname, "data");
mkdirSync(OUT, { recursive: true });
const fx = buildFixtureSet();
console.log(`Generating fixtures: 90 days ending ${fx.meta.asOf} (today ${fx.meta.today})`);
for (const [name, data] of Object.entries(fx)) {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(data));
  console.log(`  wrote ${name}.json`);
}

console.log("");
for (const company of fx.companies) {
  console.log(`${company.name} (target ${pct(company.targetMarginPct, 0)})`);
  for (const job of fx.jobs.filter((j) => j.companyId === company.id)) {
    const e = jobEvm(job, fx.codes, fx.costDays, fx.meta.asOf);
    console.log(`  ${job.name.padEnd(40)} ${pct(e.pctComplete, 0).padStart(4)} done  CPI ${index(e.cpi)}  forecast margin ${pct(e.marginAtCompletion).padStart(6)}  EAC ${money(e.eac)}`);
  }
  const alerts = fx.alerts.filter((a) => a.companyId === company.id);
  console.log(`  signals: ${alerts.filter((a) => a.severity === "critical").length} critical, ${alerts.filter((a) => a.severity === "warning").length} warning, ${alerts.filter((a) => a.severity === "info").length} info`);
  for (const a of alerts) console.log(`    [${a.severity}] ${a.title}`);
}
