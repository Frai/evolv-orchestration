import { Pool, type PoolClient } from "pg";

export const PG_POOL = Symbol("PG_POOL");

export function createPgPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
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
