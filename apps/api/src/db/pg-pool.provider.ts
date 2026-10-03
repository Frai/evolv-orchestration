import { Pool, types, type PoolClient } from "pg";

// Return dates as YYYY-MM-DD strings, numerics as numbers and timestamps as ISO strings, so row mappers
// never see a JS Date or a numeric string. float8[] is already parsed to number[] by pg.
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(1184, (v) => new Date(v).toISOString());

export const PG_POOL = Symbol("PG_POOL");

export function createPgPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const local = /localhost|127\.0\.0\.1/.test(connectionString);
  return new Pool({ connectionString, ssl: local ? false : { rejectUnauthorized: false } });
}

/** A repository method's DB handle: either the shared pool, or a client already inside a transaction. */
export type Executor = Pick<Pool, "query">;

/** Runs `fn` inside a single transaction; the client passed to `fn` must be used for every query in it. */
export async function withTransaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
