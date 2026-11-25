import { and, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions } from "../db/schema.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_MS,
  createToken,
  generateRefreshToken,
  hashRefreshToken,
} from "./security.js";

type Role = "customer" | "provider" | "admin";

export interface TokenPair {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

function pair(userId: number, role: Role, sid: string, refreshToken: string): TokenPair {
  return {
    token: createToken({ sub: userId, role, sid }),
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}

export async function createSession(userId: number, role: Role): Promise<TokenPair> {
  const refreshToken = generateRefreshToken();
  const [row] = await db
    .insert(sessions)
    .values({
      userId,
      refreshHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    })
    .returning({ id: sessions.id });
  if (!row) throw new Error("session insert failed");
  return pair(userId, role, row.id, refreshToken);
}

// Each refresh token works once. Sending an old one again ends the whole session.
export async function rotateSession(
  presented: string,
  roleOf: (userId: number) => Promise<Role | undefined>,
): Promise<TokenPair | null> {
  const hash = hashRefreshToken(presented);
  const [row] = await db
    .select()
    .from(sessions)
    .where(or(eq(sessions.refreshHash, hash), eq(sessions.prevRefreshHash, hash)));
  if (!row || row.revokedAt || row.expiresAt <= new Date()) return null;
  if (row.refreshHash !== hash) {
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, row.id));
    return null;
  }
  const role = await roleOf(row.userId);
  if (!role) return null;

  const next = generateRefreshToken();
  const [updated] = await db
    .update(sessions)
    .set({
      refreshHash: hashRefreshToken(next),
      prevRefreshHash: hash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    })
    .where(and(eq(sessions.id, row.id), eq(sessions.refreshHash, hash), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id });
  if (!updated) return null;
  return pair(row.userId, role, row.id, next);
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
}

export async function revokeByRefreshToken(token: string): Promise<void> {
  const hash = hashRefreshToken(token);
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(or(eq(sessions.refreshHash, hash), eq(sessions.prevRefreshHash, hash)));
}

// Ends every session of the user, except `keep` when given.
export async function revokeUserSessions(userId: number, keep?: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(sessions.userId, userId), isNull(sessions.revokedAt), keep ? ne(sessions.id, keep) : undefined),
    );
}
