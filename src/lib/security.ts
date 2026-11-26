import { createHash, createHmac, randomInt, scrypt, timingSafeEqual, randomBytes } from "node:crypto";
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
  sid: string;
}

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sign(data: string): string {
  return createHmac("sha256", env.JWT_SECRET).update(data).digest("base64url");
}

export function createToken(payload: TokenPayload): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;
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
    if (typeof data.sid !== "string") return null;
    return { sub: data.sub, role: data.role, sid: data.sid };
  } catch {
    return null;
  }
}

const EMAIL_PROOF_TTL_SECONDS = 30 * 60;

// Proof that an email passed the sign-up code check. Signed with the server
// secret, bound to the email, short lived, and useless as an access token.
export function createEmailProof(email: string): string {
  const exp = Math.floor(Date.now() / 1000) + EMAIL_PROOF_TTL_SECONDS;
  const body = Buffer.from(JSON.stringify({ email, purpose: "register", exp })).toString("base64url");
  return `${body}.${sign(`email-proof.${body}`)}`;
}

export function verifyEmailProof(token: string, email: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [body, signature] = parts as [string, string];
  const expected = Buffer.from(sign(`email-proof.${body}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      email?: string;
      purpose?: string;
      exp?: number;
    };
    return (
      data.purpose === "register" &&
      data.email === email &&
      typeof data.exp === "number" &&
      data.exp >= Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}
