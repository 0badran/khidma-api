import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../config/env.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// Hosted databases close idle connections. Without this handler the process crashes.
pool.on("error", (err) => {
  console.error("[db] idle client error", err.message);
});

export const db = drizzle({ client: pool });
