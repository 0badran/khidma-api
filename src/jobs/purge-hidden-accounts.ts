import { and, isNotNull, lt, ne } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";

const RETENTION_DAYS = 30;
const RUN_EVERY_MS = 6 * 60 * 60 * 1000;

// Deletes accounts hidden for 30 days. Providers and ratings are removed by foreign key cascade.
export async function purgeHiddenAccounts(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(users)
    .where(and(isNotNull(users.hiddenAt), lt(users.hiddenAt, cutoff), ne(users.role, "admin")))
    .returning({ id: users.id });
  return deleted.length;
}

// The in-process timer is a placeholder until hosting is chosen.
export function schedulePurge(): void {
  const run = () => {
    purgeHiddenAccounts()
      .then((n) => n > 0 && console.log(`[purge] removed ${n} hidden accounts`))
      .catch((err) => console.error("[purge] failed", err));
  };
  run();
  setInterval(run, RUN_EVERY_MS).unref();
}
