-- Evolv schema. Mirrors packages/contracts/src/domain.ts.
-- Reference/catalog tables are bulk-seeded once from the deterministic fixture
-- generator (apps/api/scripts/seed-supabase.ts). Mutable tables (stock_levels,
-- approvals, purchase_orders) are the actual point of this migration: they used
-- to live in process-memory Maps that reset on every restart/deploy.

create table if not exists locations (
  id text primary key,
  name text not null,
  short_name text not null,
  type text not null,
  pos text not null,
  city text not null,
  currency text not null,
  target_labour_pct numeric not null,
  menu_item_count int not null,
  staff_count int not null,
  kitchen_ticket_capacity_per_hour int not null,
  owner_name text not null,
  owner_phone text not null,
  owner_email text not null
);

create table if not exists outlets (
  id text primary key,
  location_id text not null references locations (id) on delete cascade,
  name text not null,
  kind text not null,
  kitchen_ticket_capacity_per_hour int not null
);

create table if not exists wage_bands (
  id bigserial primary key,
  location_id text not null references locations (id) on delete cascade,
  role text not null,
  hourly_rate numeric not null
);
create index if not exists wage_bands_location_idx on wage_bands (location_id);

create table if not exists menu_items (
  id bigserial primary key,
  item_id text not null,
  location_id text not null references locations (id) on delete cascade,
  outlet_id text references outlets (id) on delete cascade,
  name text not null,
  category text not null,
  price numeric not null
);
create index if not exists menu_items_location_idx on menu_items (location_id, outlet_id);
create index if not exists menu_items_item_idx on menu_items (location_id, item_id);

create table if not exists sales_days (
  id bigserial primary key,
  location_id text not null references locations (id) on delete cascade,
  outlet_id text references outlets (id) on delete cascade,
  date date not null,
  net_sales numeric not null,
  tax numeric not null,
  tips numeric not null,
  covers int not null,
  orders int not null,
  hourly int[] not null,
  hourly_orders int[] not null,
  channels jsonb not null,
  last_year_net_sales numeric not null
);
create index if not exists sales_days_location_date_idx on sales_days (location_id, date);

create table if not exists item_sales_series (
  id bigserial primary key,
  location_id text not null references locations (id) on delete cascade,
  outlet_id text references outlets (id) on delete cascade,
  item_id text not null,
  qty int[] not null
);
create index if not exists item_sales_series_location_idx on item_sales_series (location_id, item_id);

create table if not exists labour_days (
  id bigserial primary key,
  location_id text not null references locations (id) on delete cascade,
  outlet_id text references outlets (id) on delete cascade,
  date date not null,
  scheduled_hours numeric not null,
  actual_hours numeric not null,
  labour_cost numeric not null,
  shifts jsonb not null
);
create index if not exists labour_days_location_date_idx on labour_days (location_id, date);

-- Catalog half of stock (par, supplier, unit cost) — rarely changes.
create table if not exists stock_items (
  location_id text not null references locations (id) on delete cascade,
  item_id text not null,
  name text not null,
  category text not null,
  unit text not null,
  par numeric not null,
  daily_usage numeric not null,
  unit_cost numeric not null,
  supplier text not null,
  primary key (location_id, item_id)
);

-- Mutable half of stock (on-hand count) — the whole reason this migration exists.
create table if not exists stock_levels (
  location_id text not null,
  item_id text not null,
  on_hand numeric not null,
  counted_at timestamptz not null,
  primary key (location_id, item_id),
  foreign key (location_id, item_id) references stock_items (location_id, item_id) on delete cascade
);

create table if not exists agents (
  id text primary key,
  name text not null,
  description text not null,
  status text not null,
  schedule text not null,
  default_mode text not null
);

create table if not exists agent_runs (
  id text primary key,
  agent_id text not null references agents (id) on delete cascade,
  location_id text not null references locations (id) on delete cascade,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_ms int not null,
  status text not null,
  goal text not null,
  steps jsonb not null,
  outcome jsonb not null
);
create index if not exists agent_runs_location_agent_idx on agent_runs (location_id, agent_id);
create index if not exists agent_runs_location_started_idx on agent_runs (location_id, started_at);

-- Mutable — replaces the process-memory ApprovalStoreService.
create table if not exists approvals (
  id text primary key,
  location_id text not null references locations (id) on delete cascade,
  agent_id text not null references agents (id) on delete cascade,
  run_id text,
  title text not null,
  summary text not null,
  amount numeric,
  item_id text,
  evidence jsonb not null,
  status text not null,
  proposed_at timestamptz not null,
  resolved_at timestamptz,
  confirmation text not null,
  action text not null
);
create index if not exists approvals_location_idx on approvals (location_id);

-- Mutable — replaces the process-memory PurchaseOrderLedgerService. Starts empty;
-- purchase orders only ever come from a live approval resolution, never seeded.
create sequence if not exists purchase_order_seq;

create table if not exists purchase_orders (
  id text primary key,
  location_id text not null references locations (id) on delete cascade,
  approval_id text not null references approvals (id) on delete cascade,
  item_id text not null,
  item_name text not null,
  qty numeric not null,
  unit text not null,
  unit_cost numeric not null,
  total_cost numeric not null,
  supplier text not null,
  created_at timestamptz not null,
  status text not null
);
create index if not exists purchase_orders_location_idx on purchase_orders (location_id);

create table if not exists briefs (
  id bigserial primary key,
  location_id text not null references locations (id) on delete cascade,
  date date not null,
  headline text not null,
  paragraphs text[] not null,
  delivered_at timestamptz not null,
  channel text not null,
  unique (location_id, date)
);

create table if not exists qa_pairs (
  id bigserial primary key,
  location_id text not null references locations (id) on delete cascade,
  question text not null,
  keywords text[] not null,
  answer text not null
);
create index if not exists qa_pairs_location_idx on qa_pairs (location_id);

create table if not exists integrations (
  id bigserial primary key,
  location_id text not null references locations (id) on delete cascade,
  integration_id text not null,
  name text not null,
  area text not null,
  description text not null,
  state text not null,
  last_sync_at timestamptz
);
create index if not exists integrations_location_idx on integrations (location_id);

-- Append-only — send() now actually persists instead of fabricating a receipt in memory.
-- location_id is nullable: the Notifier.send() port has no locationId parameter, so a live
-- send can't be attributed to one; seeded historical rows do carry it.
create table if not exists deliveries (
  id bigserial primary key,
  location_id text references locations (id) on delete cascade,
  channel text not null,
  sent_at timestamptz not null,
  recipients text[] not null
);
create index if not exists deliveries_location_sent_idx on deliveries (location_id, sent_at desc);
