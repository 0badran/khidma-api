import { env } from "../config/env.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const REQUEST_TIMEOUT_MS = 10_000;

interface CachedToken {
  value: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

function gmailConfig() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER } = env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !GMAIL_SENDER) return null;
  return {
    clientId: GMAIL_CLIENT_ID,
    clientSecret: GMAIL_CLIENT_SECRET,
    refreshToken: GMAIL_REFRESH_TOKEN,
    sender: GMAIL_SENDER,
  };
}

// Google error bodies carry an error code and a description, never the submitted secrets.
async function describeError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as {
      error?: string | { status?: string; message?: string };
      error_description?: string;
    };
    if (typeof data.error === "object" && data.error) {
      return [data.error.status, data.error.message].filter(Boolean).join(": ");
    }
    return [data.error, data.error_description].filter(Boolean).join(": ") || "no details";
  } catch {
    return "no details";
  }
}

async function getAccessToken(cfg: NonNullable<ReturnType<typeof gmailConfig>>): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Gmail token request failed with status ${res.status}: ${await describeError(res)}`);

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Gmail token response had no access_token");
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

export function buildMessage(from: string, to: string, code: string): string {
  const subject = "Your Khidma verification code";
  const body = `Your Khidma verification code is ${code}\r\n\r\nIt expires in 10 minutes. If you did not request it, ignore this email.\r\n`;
  return [
    `From: Khidma <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
  ].join("\r\n");
}

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const cfg = gmailConfig();
  if (!cfg) {
    console.log(`[mailer] OTP for ${email}: ${code}`);
    return;
  }

  const raw = Buffer.from(buildMessage(cfg.sender, email, code), "utf8").toString("base64url");
  const token = await getAccessToken(cfg);
  const res = await fetch(SEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.status === 401) cachedToken = null;
  if (!res.ok) throw new Error(`Gmail send failed with status ${res.status}: ${await describeError(res)}`);
}
