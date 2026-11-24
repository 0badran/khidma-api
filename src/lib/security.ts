import { createHmac, randomInt, scrypt, timingSafeEqual, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { env } from "../config/env.js";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const key = (await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;
  return timingSafeEqual(key, expected);
}

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(email: string, code: string): string {
  return createHmac("sha256", env.JWT_SECRET).update(`${email}:${code}`).digest("hex");
}

export interface TokenPayload {
  sub: number;
  role: "customer" | "provider" | "admin";
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

function sign(data: string): string {
  return createHmac("sha256", env.JWT_SECRET).update(data).digest("base64url");
}

export function createToken(payload: TokenPayload): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  return `${header}.${body}.${sign(`${header}.${body}`)}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts as [string, string, string];
  const expected = Buffer.from(sign(`${header}.${body}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload & { exp: number };
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: data.sub, role: data.role };
  } catch {
    return null;
  }
}
