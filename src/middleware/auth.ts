import type { RequestHandler } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import { verifyToken } from "../lib/security.js";

export async function loadAuth(header: string | undefined) {
  if (!header?.startsWith("Bearer ")) return undefined;
  const payload = verifyToken(header.slice(7));
  if (!payload) return undefined;
  const [row] = await db
    .select({ id: users.id, role: users.role, hiddenAt: users.hiddenAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.id, payload.sid),
        eq(sessions.userId, payload.sub),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    );
  if (!row || row.hiddenAt) return undefined;
  return { id: row.id, role: row.role, sid: payload.sid };
}

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  req.auth = await loadAuth(req.headers.authorization);
  next();
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  req.auth = await loadAuth(req.headers.authorization);
  if (!req.auth) throw unauthorized();
  next();
};

export const requireRole =
  (...roles: Array<"customer" | "provider" | "admin">): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) throw unauthorized();
    if (!roles.includes(req.auth.role)) throw forbidden();
    next();
  };
