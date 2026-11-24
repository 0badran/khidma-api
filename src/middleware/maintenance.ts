import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { settings } from "../db/schema.js";
import { HttpError } from "../lib/errors.js";
import { loadAuth } from "./auth.js";

export async function isMaintenanceOn(): Promise<boolean> {
  const [row] = await db.select().from(settings).where(eq(settings.key, "maintenance_mode"));
  return row?.value === "true";
}

// While maintenance is on, only the admin, the login route and the public settings stay reachable.
export const maintenanceGuard: RequestHandler = async (req, _res, next) => {
  const open =
    req.path === "/health" ||
    req.path === "/api/auth/login" ||
    req.path === "/api/settings/public" ||
    req.path.startsWith("/api/admin");
  if (open || !(await isMaintenanceOn())) return next();
  const auth = await loadAuth(req.headers.authorization);
  if (auth?.role === "admin") return next();
  throw new HttpError(503, "errors.maintenance");
};
