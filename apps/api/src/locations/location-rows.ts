/** Shared location-row assembly, used by both the sales and narrator repositories. */
import type { Pool } from "pg";
import type { Location, Outlet, WageBand } from "@evolv/contracts/types";

interface LocationRow {
  id: string;
  name: string;
  short_name: string;
  type: string;
  pos: string;
  city: string;
  currency: string;
  target_labour_pct: string;
  menu_item_count: number;
  staff_count: number;
  kitchen_ticket_capacity_per_hour: number;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
}

interface OutletRow {
  id: string;
  location_id: string;
  name: string;
  kind: string;
  kitchen_ticket_capacity_per_hour: number;
}

interface WageBandRow {
  location_id: string;
  role: string;
  hourly_rate: string;
}

function assemble(row: LocationRow, outlets: OutletRow[], wageBands: WageBandRow[]): Location {
  const locOutlets: Outlet[] = outlets
    .filter((o) => o.location_id === row.id)
    .map((o) => ({ id: o.id, name: o.name, kind: o.kind as Outlet["kind"], kitchenTicketCapacityPerHour: o.kitchen_ticket_capacity_per_hour }));
  const locWageBands: WageBand[] = wageBands.filter((w) => w.location_id === row.id).map((w) => ({ role: w.role, hourlyRate: Number(w.hourly_rate) }));

  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    type: row.type as Location["type"],
    pos: row.pos as Location["pos"],
    city: row.city,
    currency: row.currency as Location["currency"],
    targetLabourPct: Number(row.target_labour_pct),
    menuItemCount: row.menu_item_count,
    staffCount: row.staff_count,
    wageBands: locWageBands,
    kitchenTicketCapacityPerHour: row.kitchen_ticket_capacity_per_hour,
    outlets: locOutlets.length ? locOutlets : undefined,
    owner: { name: row.owner_name, phone: row.owner_phone, email: row.owner_email },
  };
}

export async function listLocations(pool: Pool): Promise<Location[]> {
  const [{ rows: locs }, { rows: outlets }, { rows: wageBands }] = await Promise.all([
    pool.query<LocationRow>(`select * from locations order by name`),
    pool.query<OutletRow>(`select * from outlets`),
    pool.query<WageBandRow>(`select * from wage_bands`),
  ]);
  return locs.map((r) => assemble(r, outlets, wageBands));
}

export async function getLocationById(pool: Pool, id: string): Promise<Location | undefined> {
  const { rows } = await pool.query<LocationRow>(`select * from locations where id = $1`, [id]);
  if (!rows[0]) return undefined;
  const [{ rows: outlets }, { rows: wageBands }] = await Promise.all([
    pool.query<OutletRow>(`select * from outlets where location_id = $1`, [id]),
    pool.query<WageBandRow>(`select * from wage_bands where location_id = $1`, [id]),
  ]);
  return assemble(rows[0], outlets, wageBands);
}
