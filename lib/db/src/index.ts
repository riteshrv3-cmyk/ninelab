import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// Neon drops idle connections (compute suspend, network blips). Without a
// listener, pg re-emits that as an uncaught "error" event and the whole API
// process exits. The pool discards the broken client on its own.
pool.on("error", (err) => {
  console.error("pg idle client error:", err.message);
});
export const db = drizzle(pool, { schema });

export * from "./schema";
