/**
 * One-time (or deliberately rerun) seed of Supabase from the deterministic fixture
 * generator. Truncates every table it touches first, so it's safe to rerun — this is
 * synthetic demo data, not user data, so a full reseed is the simplest correct behaviour.
 * `stock_levels`, `approvals` and `purchase_orders`' mutable runtime state is seeded once
 * here and then evolves for real from there on.
 *
 * Usage: DATABASE_URL=... npm run seed --workspace=@evolv/api
 */
import "dotenv/config";
import { Pool } from "pg";
import { buildFixtureSet } from "../src/fixtures/gen/build";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const fx = buildFixtureSet();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      truncate table
        deliveries, integrations, qa_pairs, briefs, purchase_orders, approvals, agent_runs, agents,
        stock_levels, stock_items, labour_days, item_sales_series, sales_days, menu_items,
        wage_bands, outlets, locations
      restart identity cascade
    `);

    for (const loc of fx.locations) {
      await client.query(
        `insert into locations (id, name, short_name, type, pos, city, currency, target_labour_pct, menu_item_count, staff_count, kitchen_ticket_capacity_per_hour, owner_name, owner_phone, owner_email)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          loc.id, loc.name, loc.shortName, loc.type, loc.pos, loc.city, loc.currency, loc.targetLabourPct,
          loc.menuItemCount, loc.staffCount, loc.kitchenTicketCapacityPerHour, loc.owner.name, loc.owner.phone, loc.owner.email,
        ],
      );
      for (const outlet of loc.outlets ?? []) {
        await client.query(
          `insert into outlets (id, location_id, name, kind, kitchen_ticket_capacity_per_hour) values ($1,$2,$3,$4,$5)`,
          [outlet.id, loc.id, outlet.name, outlet.kind, outlet.kitchenTicketCapacityPerHour],
        );
      }
      for (const wb of loc.wageBands) {
        await client.query(`insert into wage_bands (location_id, role, hourly_rate) values ($1,$2,$3)`, [loc.id, wb.role, wb.hourlyRate]);
      }
    }
    console.log(`  locations: ${fx.locations.length}`);

    for (const m of fx.menus) {
      for (const item of m.items) {
        await client.query(
          `insert into menu_items (item_id, location_id, outlet_id, name, category, price) values ($1,$2,$3,$4,$5,$6)`,
          [item.id, m.locationId, m.outletId ?? null, item.name, item.category, item.price],
        );
      }
    }
    console.log(`  menu_items: ${fx.menus.reduce((a, m) => a + m.items.length, 0)}`);

    for (const d of fx.sales) {
      await client.query(
        `insert into sales_days (location_id, outlet_id, date, net_sales, tax, tips, covers, orders, hourly, hourly_orders, channels, last_year_net_sales)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          d.locationId, d.outletId ?? null, d.date, d.netSales, d.tax, d.tips, d.covers, d.orders,
          d.hourly, d.hourlyOrders, JSON.stringify(d.channels), d.lastYearNetSales,
        ],
      );
    }
    console.log(`  sales_days: ${fx.sales.length}`);

    for (const s of fx.itemSeries) {
      await client.query(
        `insert into item_sales_series (location_id, outlet_id, item_id, qty) values ($1,$2,$3,$4)`,
        [s.locationId, s.outletId ?? null, s.itemId, s.qty],
      );
    }
    console.log(`  item_sales_series: ${fx.itemSeries.length}`);

    for (const d of fx.labour) {
      await client.query(
        `insert into labour_days (location_id, outlet_id, date, scheduled_hours, actual_hours, labour_cost, shifts)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [d.locationId, d.outletId ?? null, d.date, d.scheduledHours, d.actualHours, d.labourCost, JSON.stringify(d.shifts)],
      );
    }
    console.log(`  labour_days: ${fx.labour.length}`);

    for (const s of fx.stock) {
      await client.query(
        `insert into stock_items (location_id, item_id, name, category, unit, par, daily_usage, unit_cost, supplier)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [s.locationId, s.itemId, s.name, s.category, s.unit, s.par, s.dailyUsage, s.unitCost, s.supplier],
      );
      await client.query(
        `insert into stock_levels (location_id, item_id, on_hand, counted_at) values ($1,$2,$3,$4)`,
        [s.locationId, s.itemId, s.onHand, s.countedAt],
      );
    }
    console.log(`  stock_items / stock_levels: ${fx.stock.length}`);

    for (const a of fx.agents) {
      await client.query(
        `insert into agents (id, name, description, status, schedule, default_mode) values ($1,$2,$3,$4,$5,$6)`,
        [a.id, a.name, a.description, a.status, a.schedule, a.defaultMode],
      );
    }
    console.log(`  agents: ${fx.agents.length}`);

    for (const r of fx.runs) {
      await client.query(
        `insert into agent_runs (id, agent_id, location_id, started_at, finished_at, duration_ms, status, goal, steps, outcome)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [r.id, r.agentId, r.locationId, r.startedAt, r.finishedAt, r.durationMs, r.status, r.goal, JSON.stringify(r.steps), JSON.stringify(r.outcome)],
      );
    }
    console.log(`  agent_runs: ${fx.runs.length}`);

    for (const a of fx.approvals) {
      await client.query(
        `insert into approvals (id, location_id, agent_id, run_id, title, summary, amount, item_id, evidence, status, proposed_at, resolved_at, confirmation, action)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          a.id, a.locationId, a.agentId, a.runId ?? null, a.title, a.summary, a.amount ?? null, a.itemId ?? null,
          JSON.stringify(a.evidence), a.status, a.proposedAt, a.resolvedAt ?? null, a.confirmation, a.action,
        ],
      );
    }
    console.log(`  approvals: ${fx.approvals.length}`);

    for (const b of fx.briefs) {
      await client.query(
        `insert into briefs (location_id, date, headline, paragraphs, delivered_at, channel) values ($1,$2,$3,$4,$5,$6)`,
        [b.locationId, b.date, b.headline, b.paragraphs, b.deliveredAt, b.channel],
      );
    }
    console.log(`  briefs: ${fx.briefs.length}`);

    for (const q of fx.qa) {
      await client.query(
        `insert into qa_pairs (location_id, question, keywords, answer) values ($1,$2,$3,$4)`,
        [q.locationId, q.question, q.keywords, q.answer],
      );
    }
    console.log(`  qa_pairs: ${fx.qa.length}`);

    let integrationRows = 0;
    for (const i of fx.integrations) {
      for (const integ of i.integrations) {
        await client.query(
          `insert into integrations (location_id, integration_id, name, area, description, state, last_sync_at) values ($1,$2,$3,$4,$5,$6,$7)`,
          [i.locationId, integ.id, integ.name, integ.area, integ.description, integ.state, integ.lastSyncAt ?? null],
        );
        integrationRows++;
      }
    }
    console.log(`  integrations: ${integrationRows}`);

    for (const d of fx.deliveries) {
      await client.query(
        `insert into deliveries (location_id, channel, sent_at, recipients) values ($1,$2,$3,$4)`,
        [d.locationId, d.channel, d.sentAt, d.to],
      );
    }
    console.log(`  deliveries: ${fx.deliveries.length}`);

    await client.query("COMMIT");
    console.log("\nSeed complete.");
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
