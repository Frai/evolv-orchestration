/**
 * One-time (or deliberately rerun) seed of Postgres from the deterministic fixture
 * generator. Truncates every table it touches first, so it is safe to rerun: this is
 * synthetic demo data, not user data. `approvals` and `change_orders` hold mutable runtime
 * state that is seeded once here and then evolves for real as approvals are resolved.
 *
 * Usage: DATABASE_URL=... npm run seed --workspace=@evolv/api
 */
import "dotenv/config";
import type { PoolClient } from "pg";
import { Pool } from "pg";
import { buildFixtureSet } from "../src/fixtures/gen/build";

/** Multi-row insert in chunks, so seeding thousands of cost-day rows over a network stays quick. */
async function bulkInsert(client: PoolClient, table: string, columns: string[], rows: unknown[][], chunk = 400) {
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const params: unknown[] = [];
    const tuples = slice.map((row) => `(${row.map((v) => (params.push(v), `$${params.length}`)).join(",")})`);
    await client.query(`insert into ${table} (${columns.join(",")}) values ${tuples.join(",")}`, params);
  }
  console.log(`  ${table}: ${rows.length}`);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const ssl = /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false };
  const pool = new Pool({ connectionString, ssl });
  const fx = buildFixtureSet();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      truncate table
        deliveries, integrations, qa_pairs, briefs, approvals, agent_runs, agents,
        safety_events, commitments, equipment, invoices, field_tickets, change_orders,
        cost_days, cost_codes, jobs, companies
      restart identity cascade
    `);

    await bulkInsert(client, "companies", ["id", "name", "short_name", "segment", "accounting", "city", "currency", "employee_count", "target_margin_pct", "owner_name", "owner_role", "owner_phone", "owner_email"],
      fx.companies.map((c) => [c.id, c.name, c.shortName, c.segment, c.accounting, c.city, c.currency, c.employeeCount, c.targetMarginPct, c.owner.name, c.owner.role, c.owner.phone, c.owner.email]));
    await bulkInsert(client, "jobs", ["id", "company_id", "name", "client", "contract_value", "start_date", "end_date", "status", "pm"],
      fx.jobs.map((j) => [j.id, j.companyId, j.name, j.client, j.contractValue, j.startDate, j.endDate, j.status, j.pm]));
    await bulkInsert(client, "cost_codes", ["id", "job_id", "code", "name", "category", "budget", "planned_qty", "unit", "planned_start", "planned_end", "extra"],
      fx.codes.map((c) => [c.id, c.jobId, c.code, c.name, c.category, c.budget, c.plannedQty, c.unit, c.plannedStart, c.plannedEnd, !!c.extra]));
    await bulkInsert(client, "cost_days", ["job_id", "code_id", "date", "hours", "overtime_hours", "cost", "qty"],
      fx.costDays.map((d) => [d.jobId, d.codeId, d.date, d.hours, d.overtimeHours, d.cost, d.qty]));
    await bulkInsert(client, "change_orders", ["id", "job_id", "number", "title", "amount", "status", "code_id", "created_at", "submitted_at"],
      fx.changeOrders.map((c) => [c.id, c.jobId, c.number, c.title, c.amount, c.status, c.codeId ?? null, c.createdAt, c.submittedAt ?? null]));
    await bulkInsert(client, "field_tickets", ["id", "company_id", "job_id", "number", "date", "crew", "description", "labour_hours", "equipment_hours", "amount", "status", "signed_at", "submitted_at", "dispute_reason"],
      fx.tickets.map((t) => [t.id, t.companyId, t.jobId, t.number, t.date, t.crew, t.description, t.labourHours, t.equipmentHours, t.amount, t.status, t.signedAt ?? null, t.submittedAt ?? null, t.disputeReason ?? null]));
    await bulkInsert(client, "invoices", ["id", "job_id", "number", "period_end", "amount", "status", "issued_at", "due_date", "paid_at"],
      fx.invoices.map((i) => [i.id, i.jobId, i.number, i.periodEnd, i.amount, i.status, i.issuedAt ?? null, i.dueDate ?? null, i.paidAt ?? null]));
    await bulkInsert(client, "equipment", ["id", "job_id", "name", "type", "ownership", "daily_rate", "usage_hours14", "service_due_date"],
      fx.equipment.map((e) => [e.id, e.jobId, e.name, e.type, e.ownership, e.dailyRate, e.usageHours14, e.serviceDueDate ?? null]));
    await bulkInsert(client, "commitments", ["id", "job_id", "vendor", "description", "kind", "committed", "invoiced", "promised_date", "need_date", "status"],
      fx.commitments.map((c) => [c.id, c.jobId, c.vendor, c.description, c.kind, c.committed, c.invoiced, c.promisedDate, c.needDate, c.status]));
    await bulkInsert(client, "safety_events", ["id", "job_id", "kind", "date", "title", "owner", "corrective_due", "status"],
      fx.safety.map((s) => [s.id, s.jobId, s.kind, s.date, s.title, s.owner, s.correctiveDue, s.status]));
    await bulkInsert(client, "agents", ["id", "name", "description", "status", "schedule", "default_mode"],
      fx.agents.map((a) => [a.id, a.name, a.description, a.status, a.schedule, a.defaultMode]));
    await bulkInsert(client, "agent_runs", ["id", "agent_id", "company_id", "started_at", "finished_at", "duration_ms", "status", "goal", "steps", "outcome"],
      fx.runs.map((r) => [r.id, r.agentId, r.companyId, r.startedAt, r.finishedAt, r.durationMs, r.status, r.goal, JSON.stringify(r.steps), JSON.stringify(r.outcome)]));
    await bulkInsert(client, "approvals", ["id", "company_id", "agent_id", "run_id", "title", "summary", "amount", "ref_id", "evidence", "status", "proposed_at", "resolved_at", "confirmation", "action"],
      fx.approvals.map((a) => [a.id, a.companyId, a.agentId, a.runId ?? null, a.title, a.summary, a.amount ?? null, a.refId ?? null, JSON.stringify(a.evidence), a.status, a.proposedAt, a.resolvedAt ?? null, a.confirmation, a.action]));
    await bulkInsert(client, "briefs", ["company_id", "date", "headline", "paragraphs", "delivered_at", "channel"],
      fx.briefs.map((b) => [b.companyId, b.date, b.headline, b.paragraphs, b.deliveredAt, b.channel]));
    await bulkInsert(client, "qa_pairs", ["company_id", "question", "keywords", "answer"],
      fx.qa.map((q) => [q.companyId, q.question, q.keywords, q.answer]));
    await bulkInsert(client, "integrations", ["company_id", "integration_id", "name", "area", "description", "state", "last_sync_at"],
      fx.integrations.flatMap((f) => f.integrations.map((i) => [f.companyId, i.id, i.name, i.area, i.description, i.state, i.lastSyncAt ?? null])));
    await bulkInsert(client, "deliveries", ["company_id", "channel", "sent_at", "recipients"],
      fx.deliveries.map((d) => [d.companyId, d.channel, d.sentAt, d.to]));

    await client.query("COMMIT");
    console.log(`Seeded as of ${fx.meta.asOf}.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
