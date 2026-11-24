import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { settings } from "../../db/schema.js";

export async function getPublicSettings() {
  const rows = await db.select().from(settings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    appName: map.get("app_name") ?? "khidma",
    logoUrl: map.get("logo_url") ?? null,
    maintenanceMode: map.get("maintenance_mode") === "true",
  };
}

export async function setSetting(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function clearSetting(key: string) {
  await db.delete(settings).where(eq(settings.key, key));
}
