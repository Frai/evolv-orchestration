-- Evolv for oil & gas field contractors. Replaces the restaurant schema from 0001.
-- Mirrors packages/contracts/src/domain.ts. Reference tables are bulk-seeded from the
-- deterministic fixture generator (apps/api/scripts/seed-supabase.ts). Mutable tables
-- (approvals, change_orders) are the ones real approvals write to; they used to be
-- restaurant stock and purchase orders.

drop table if exists
  deliveries, integrations, qa_pairs, briefs, purchase_orders, approvals, agent_runs, agents,
  stock_levels, stock_items, labour_days, item_sales_series, sales_days, menu_items,
  wage_bands, outlets, locations
  cascade;
drop sequence if exists purchase_order_seq;

create table companies (
  id text primary key,
  name text not null,
  short_name text not null,
  segment text not null,
  accounting text not null,
  city text not null,
  currency text not null,
  employee_count int not null,
  target_margin_pct numeric not null,
  owner_name text not null,
  owner_role text not null,
  owner_phone text not null,
  owner_email text not null
);

create table jobs (
  id text primary key,
  company_id text not null references companies (id) on delete cascade,
  name text not null,
  client text not null,
  contract_value numeric not null,
  start_date date not null,
  end_date date not null,
  status text not null,
  pm text not null
);
create index jobs_company_idx on jobs (company_id);

create table cost_codes (
  id text primary key,
  job_id text not null references jobs (id) on delete cascade,
  code text not null,
  name text not null,
  category text not null,
  budget numeric not null,
  planned_qty numeric not null,
  unit text not null,
  planned_start date not null,
  planned_end date not null,
  extra boolean not null default false
);
create index cost_codes_job_idx on cost_codes (job_id);

create table cost_days (
  id bigserial primary key,
  job_id text not null references jobs (id) on delete cascade,
  code_id text not null references cost_codes (id) on delete cascade,
  date date not null,
  hours numeric not null,
  overtime_hours numeric not null,
  cost numeric not null,
  qty numeric not null
);
create index cost_days_job_date_idx on cost_days (job_id, date);

-- Mutable: approving a change-order draft inserts a row here.
create table change_orders (
  id text primary key,
  job_id text not null references jobs (id) on delete cascade,
  number text not null,
  title text not null,
  amount numeric not null,
  status text not null,
  code_id text references cost_codes (id) on delete set null,
  created_at timestamptz not null,
  submitted_at timestamptz
);
create index change_orders_job_idx on change_orders (job_id);

create table field_tickets (
  id text primary key,
  company_id text not null references companies (id) on delete cascade,
  job_id text not null references jobs (id) on delete cascade,
  number text not null,
  date date not null,
  crew text not null,
  description text not null,
  labour_hours numeric not null,
  equipment_hours numeric not null,
  amount numeric not null,
  status text not null,
  signed_at timestamptz,
  submitted_at timestamptz,
  dispute_reason text
);
create index field_tickets_company_idx on field_tickets (company_id);

create table invoices (
  id text primary key,
  job_id text not null references jobs (id) on delete cascade,
  number text not null,
  period_end date not null,
  amount numeric not null,
  status text not null,
  issued_at date,
  due_date date,
  paid_at date
);
create index invoices_job_idx on invoices (job_id);

create table equipment (
  id text primary key,
  job_id text not null references jobs (id) on delete cascade,
  name text not null,
  type text not null,
  ownership text not null,
  daily_rate numeric not null,
  usage_hours14 double precision[] not null,
  service_due_date date
);
create index equipment_job_idx on equipment (job_id);

create table commitments (
  id text primary key,
  job_id text not null references jobs (id) on delete cascade,
  vendor text not null,
  description text not null,
  kind text not null,
  committed numeric not null,
  invoiced numeric not null,
  promised_date date not null,
  need_date date not null,
  status text not null
);
create index commitments_job_idx on commitments (job_id);

create table safety_events (
  id text primary key,
  job_id text not null references jobs (id) on delete cascade,
  kind text not null,
  date date not null,
  title text not null,
  owner text not null,
  corrective_due date not null,
  status text not null
);
create index safety_events_job_idx on safety_events (job_id);

create table agents (
  id text primary key,
  name text not null,
  description text not null,
  status text not null,
  schedule text not null,
  default_mode text not null
);

create table agent_runs (
  id text primary key,
  agent_id text not null references agents (id) on delete cascade,
  company_id text not null references companies (id) on delete cascade,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_ms int not null,
  status text not null,
  goal text not null,
  steps jsonb not null,
  outcome jsonb not null
);
create index agent_runs_company_agent_idx on agent_runs (company_id, agent_id);
create index agent_runs_company_started_idx on agent_runs (company_id, started_at);

-- Mutable: replaces the process-memory approval store.
create table approvals (
  id text primary key,
  company_id text not null references companies (id) on delete cascade,
  agent_id text not null references agents (id) on delete cascade,
  run_id text,
  title text not null,
  summary text not null,
  amount numeric,
  ref_id text,
  evidence jsonb not null,
  status text not null,
  proposed_at timestamptz not null,
  resolved_at timestamptz,
  confirmation text not null,
  action text not null
);
create index approvals_company_idx on approvals (company_id);

create table briefs (
  id bigserial primary key,
  company_id text not null references companies (id) on delete cascade,
  date date not null,
  headline text not null,
  paragraphs text[] not null,
  delivered_at timestamptz not null,
  channel text not null,
  unique (company_id, date)
);

create table qa_pairs (
  id bigserial primary key,
  company_id text not null references companies (id) on delete cascade,
  question text not null,
  keywords text[] not null,
  answer text not null
);
create index qa_pairs_company_idx on qa_pairs (company_id);

create table integrations (
  id bigserial primary key,
  company_id text not null references companies (id) on delete cascade,
  integration_id text not null,
  name text not null,
  area text not null,
  description text not null,
  state text not null,
  last_sync_at timestamptz
);
create index integrations_company_idx on integrations (company_id);

-- Append-only. company_id is nullable: the Notifier.send() port has no company parameter,
-- so a live send can't be attributed to one; seeded historical rows do carry it.
create table deliveries (
  id bigserial primary key,
  company_id text references companies (id) on delete cascade,
  channel text not null,
  sent_at timestamptz not null,
  recipients text[] not null
);
create index deliveries_company_sent_idx on deliveries (company_id, sent_at desc);
