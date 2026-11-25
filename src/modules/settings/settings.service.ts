import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { settings } from "../../db/schema.js";
import { defaultTheme, type Theme, type ThemeInput } from "./theme.js";

export async function getTheme(): Promise<Theme> {
  const [row] = await db.select().from(settings).where(eq(settings.key, "theme"));
  if (!row) return defaultTheme;
  try {
    const stored = JSON.parse(row.value) as ThemeInput;
    return {
      light: { ...defaultTheme.light, ...stored.light },
      dark: { ...defaultTheme.dark, ...stored.dark },
    };
  } catch {
    return defaultTheme;
  }
}

export async function setTheme(input: ThemeInput): Promise<Theme> {
  const current = await getTheme();
  const next: Theme = {
    light: { ...current.light, ...input.light },
    dark: { ...current.dark, ...input.dark },
  };
  await setSetting("theme", JSON.stringify(next));
  return next;
}

export async function getPublicSettings() {
  const rows = await db.select().from(settings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    appName: map.get("app_name") ?? "khidma",
    logoUrl: map.get("logo_url") ?? null,
    maintenanceMode: map.get("maintenance_mode") === "true",
    theme: await getTheme(),
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
