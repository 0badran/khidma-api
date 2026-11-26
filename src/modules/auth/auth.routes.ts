import { Router } from "express";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { categories, cities, governorates, otpCodes, providers, users } from "../../db/schema.js";
import { HttpError, badRequest, conflict, unauthorized } from "../../lib/errors.js";
import { sendOtpEmail } from "../../lib/mailer.js";
import {
  createEmailProof,
  generateOtp,
  hashOtp,
  hashPassword,
  verifyEmailProof,
  verifyPassword,
} from "../../lib/security.js";
import { createSession, revokeByRefreshToken, revokeSession, revokeUserSessions, rotateSession } from "../../lib/sessions.js";
import { ValidationError, parse, phoneRegex } from "../../lib/validate.js";
import { loadAuth, requireAuth } from "../../middleware/auth.js";
import { isMaintenanceOn } from "../../middleware/maintenance.js";

export const authRouter = Router();

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const emailSchema = z.email().transform((v) => v.trim().toLowerCase());
const phoneSchema = z.string().trim().regex(phoneRegex);

authRouter.post("/register/request-otp", async (req, res) => {
  const { email } = parse(z.object({ email: emailSchema }), req.body);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) throw conflict("errors.emailTaken");

  const [last] = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(and(eq(otpCodes.email, email), eq(otpCodes.purpose, "register")))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (last && Date.now() - last.createdAt.getTime() < OTP_RESEND_MS) {
    throw new HttpError(429, "errors.badRequest");
  }

  const code = generateOtp();
  await db.insert(otpCodes).values({
    email,
    purpose: "register",
    codeHash: hashOtp(email, code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  await sendOtpEmail(email, code);
  res.json({ message: req.t("messages.otpSent") });
});

authRouter.post("/register/verify-otp", async (req, res) => {
  const { email, otp: code } = parse(
    z.object({ email: emailSchema, otp: z.string().regex(/^\d{6}$/) }),
    req.body,
  );
  const [otp] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, email),
        eq(otpCodes.purpose, "register"),
        isNull(otpCodes.consumedAt),
        gt(otpCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!otp) throw badRequest("errors.otpInvalid");
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(429, "errors.otpTooManyAttempts");
  if (otp.codeHash !== hashOtp(email, code)) {
    await db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
    throw badRequest("errors.otpInvalid");
  }
  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, otp.id));
  res.json({ message: req.t("messages.otpVerified"), verificationToken: createEmailProof(email) });
});

const registerSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("customer"),
    name: z.string().trim().min(2).max(100),
    phone: phoneSchema,
    email: emailSchema,
    password: z.string().min(8).max(128),
    birthDate: z.iso.date().optional(),
    verificationToken: z.string().min(1).max(500),
  }),
  z.object({
    role: z.literal("provider"),
    name: z.string().trim().min(2).max(100),
    phone: phoneSchema,
    email: emailSchema,
    password: z.string().min(8).max(128),
    birthDate: z.iso.date(),
    verificationToken: z.string().min(1).max(500),
    categoryId: z.number().int().positive(),
    cityId: z.number().int().positive(),
    photoUrl: z.url().optional(),
    yearsOfExperience: z.number().int().min(0).max(60).optional(),
    bio: z.string().trim().max(1000).optional(),
  }),
]);

authRouter.post("/register", async (req, res) => {
  const body = parse(registerSchema, req.body);

  // The email proof comes from verify-otp. Without it no account is created.
  if (!verifyEmailProof(body.verificationToken, body.email)) {
    throw new ValidationError({ verificationToken: [req.t("errors.verificationInvalid")] });
  }

  const [phoneUser] = await db.select({ id: users.id }).from(users).where(eq(users.phone, body.phone));
  if (phoneUser) throw conflict("errors.phoneTaken");
  const [emailUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email));
  if (emailUser) throw conflict("errors.emailTaken");

  if (body.role === "provider") {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, body.categoryId));
    if (!category) throw badRequest("errors.categoryNotFound");
    const [city] = await db.select({ id: cities.id }).from(cities).where(eq(cities.id, body.cityId));
    if (!city) throw badRequest("errors.cityNotFound");
  }

  const passwordHash = await hashPassword(body.password);
  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        role: body.role,
        name: body.name,
        phone: body.phone,
        email: body.email,
        passwordHash,
        birthDate: body.birthDate,
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
      })
      .returning({ id: users.id, role: users.role });
    if (!created) throw new Error("user insert failed");
    if (body.role === "provider") {
      await tx.insert(providers).values({
        userId: created.id,
        categoryId: body.categoryId,
        cityId: body.cityId,
        photoUrl: body.photoUrl,
        yearsOfExperience: body.yearsOfExperience,
        bio: body.bio,
      });
    }
    return created;
  });

  res.status(201).json({ ...(await createSession(user.id, user.role)), user });
});

const loginSchema = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const { identifier, password } = parse(loginSchema, req.body);
  const key = identifier.includes("@") ? identifier.toLowerCase() : identifier;
  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, key), eq(users.phone, key)));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw unauthorized("errors.invalidCredentials");
  }
  if (user.role !== "admin" && (await isMaintenanceOn())) {
    throw new HttpError(503, "errors.maintenance");
  }

  const restored = user.hiddenAt !== null;
  await db.update(users).set({ lastLoginAt: new Date(), hiddenAt: null }).where(eq(users.id, user.id));
  res.json({
    ...(await createSession(user.id, user.role)),
    user: { id: user.id, role: user.role, name: user.name },
    message: restored ? req.t("messages.accountRestored") : undefined,
  });
});

// Forgot password. The request answers the same way whether or not the email has an account.
authRouter.post("/forgot-password/request-otp", async (req, res) => {
  const { email } = parse(z.object({ email: emailSchema }), req.body);
  const reply = { message: req.t("messages.resetOtpSent") };

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!user) {
    res.json(reply);
    return;
  }
  const [last] = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(and(eq(otpCodes.email, email), eq(otpCodes.purpose, "reset_password")))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (last && Date.now() - last.createdAt.getTime() < OTP_RESEND_MS) {
    res.json(reply);
    return;
  }

  const code = generateOtp();
  await db.insert(otpCodes).values({
    email,
    purpose: "reset_password",
    codeHash: hashOtp(email, code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  await sendOtpEmail(email, code, "reset_password");
  res.json(reply);
});

const resetSchema = z.object({
  email: emailSchema,
  otp: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(128),
});

authRouter.post("/forgot-password/reset", async (req, res) => {
  const body = parse(resetSchema, req.body);
  const [otp] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, body.email),
        eq(otpCodes.purpose, "reset_password"),
        isNull(otpCodes.consumedAt),
        gt(otpCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!otp) throw badRequest("errors.otpInvalid");
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(429, "errors.otpTooManyAttempts");
  if (otp.codeHash !== hashOtp(body.email, body.otp)) {
    await db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
    throw badRequest("errors.otpInvalid");
  }

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email));
  if (!user) throw badRequest("errors.otpInvalid");
  const passwordHash = await hashPassword(body.newPassword);
  await db.transaction(async (tx) => {
    await tx.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, otp.id));
    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  });
  await revokeUserSessions(user.id);
  res.json({ message: req.t("messages.passwordReset") });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const [user] = await db
    .select({
      id: users.id,
      role: users.role,
      name: users.name,
      phone: users.phone,
      email: users.email,
      birthDate: users.birthDate,
    })
    .from(users)
    .where(eq(users.id, req.auth!.id));

  // Providers also get their own profile, so the edit page needs no second request.
  let provider = null;
  if (user?.role === "provider") {
    [provider = null] = await db
      .select({
        categoryId: providers.categoryId,
        categoryNameAr: categories.nameAr,
        categoryNameEn: categories.nameEn,
        cityId: providers.cityId,
        cityNameAr: cities.nameAr,
        cityNameEn: cities.nameEn,
        governorateId: cities.governorateId,
        governorateNameAr: governorates.nameAr,
        governorateNameEn: governorates.nameEn,
        photoUrl: providers.photoUrl,
        yearsOfExperience: providers.yearsOfExperience,
        bio: providers.bio,
        isActive: providers.isActive,
      })
      .from(providers)
      .innerJoin(categories, eq(categories.id, providers.categoryId))
      .leftJoin(cities, eq(cities.id, providers.cityId))
      .leftJoin(governorates, eq(governorates.id, cities.governorateId))
      .where(eq(providers.userId, user.id));
  }
  res.json({ user, ...(provider ? { provider } : {}) });
});

// Deleting an account hides it. It is purged after 30 days without sign-in.
authRouter.delete("/me", requireAuth, async (req, res) => {
  if (req.auth!.role === "admin") throw new HttpError(403, "errors.forbidden");
  await db.update(users).set({ hiddenAt: new Date() }).where(eq(users.id, req.auth!.id));
  await revokeUserSessions(req.auth!.id);
  res.json({ message: req.t("messages.accountHidden") });
});

// Trades a refresh token for a new access token and a new refresh token. Each refresh token works once.
authRouter.post("/refresh", async (req, res) => {
  const { refreshToken } = parse(z.object({ refreshToken: z.string().min(20).max(200) }), req.body);
  const pair = await rotateSession(refreshToken, async (userId) => {
    const [user] = await db
      .select({ role: users.role, hiddenAt: users.hiddenAt })
      .from(users)
      .where(eq(users.id, userId));
    return user && !user.hiddenAt ? user.role : undefined;
  });
  if (!pair) throw unauthorized("errors.refreshInvalid");
  res.json(pair);
});

// Ends the session on the server. Works with the access token, the refresh token, or both.
// The answer is the same when the token is already dead, so a client can always clear itself.
authRouter.post("/logout", async (req, res) => {
  const { refreshToken } = parse(z.object({ refreshToken: z.string().max(200).optional() }), req.body ?? {});
  const auth = await loadAuth(req.headers.authorization);
  if (auth) await revokeSession(auth.sid);
  if (refreshToken) await revokeByRefreshToken(refreshToken);
  res.json({ message: req.t("messages.loggedOut") });
});

async function requireCurrentPassword(userId: number, password: string) {
  const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw badRequest("errors.currentPasswordWrong");
  }
}

// Changing the password signs out every other device. This one keeps its session.
authRouter.post("/change-password", requireAuth, async (req, res) => {
  const body = parse(
    z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) }),
    req.body,
  );
  await requireCurrentPassword(req.auth!.id, body.currentPassword);
  const passwordHash = await hashPassword(body.newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, req.auth!.id));
  await revokeUserSessions(req.auth!.id, req.auth!.sid);
  res.json({ message: req.t("messages.passwordChanged") });
});

// Changing the email needs the password, and a code sent to the new address.
authRouter.post("/change-email/request-otp", requireAuth, async (req, res) => {
  const body = parse(z.object({ newEmail: emailSchema, password: z.string().min(1) }), req.body);
  await requireCurrentPassword(req.auth!.id, body.password);
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, body.newEmail));
  if (taken) throw conflict("errors.emailTaken");

  const [last] = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(and(eq(otpCodes.email, body.newEmail), eq(otpCodes.purpose, "change_email")))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (last && Date.now() - last.createdAt.getTime() < OTP_RESEND_MS) {
    throw new HttpError(429, "errors.badRequest");
  }

  const code = generateOtp();
  await db.insert(otpCodes).values({
    email: body.newEmail,
    purpose: "change_email",
    codeHash: hashOtp(body.newEmail, code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  await sendOtpEmail(body.newEmail, code, "change_email");
  res.json({ message: req.t("messages.otpSent") });
});

authRouter.post("/change-email", requireAuth, async (req, res) => {
  const body = parse(z.object({ newEmail: emailSchema, otp: z.string().regex(/^\d{6}$/) }), req.body);
  const [otp] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, body.newEmail),
        eq(otpCodes.purpose, "change_email"),
        isNull(otpCodes.consumedAt),
        gt(otpCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!otp) throw badRequest("errors.otpInvalid");
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(429, "errors.otpTooManyAttempts");
  if (otp.codeHash !== hashOtp(body.newEmail, body.otp)) {
    await db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
    throw badRequest("errors.otpInvalid");
  }

  try {
    await db.transaction(async (tx) => {
      await tx.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, otp.id));
      await tx
        .update(users)
        .set({ email: body.newEmail, emailVerifiedAt: new Date() })
        .where(eq(users.id, req.auth!.id));
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict("errors.emailTaken");
    throw err;
  }
  res.json({ message: req.t("messages.emailChanged"), email: body.newEmail });
});

// The phone is not verified (no SMS), so changing it needs the password only.
authRouter.post("/change-phone", requireAuth, async (req, res) => {
  const body = parse(z.object({ newPhone: phoneSchema, password: z.string().min(1) }), req.body);
  await requireCurrentPassword(req.auth!.id, body.password);
  try {
    await db.update(users).set({ phone: body.newPhone }).where(eq(users.id, req.auth!.id));
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict("errors.phoneTaken");
    throw err;
  }
  res.json({ message: req.t("messages.phoneChanged"), phone: body.newPhone });
});

function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  while (current && typeof current === "object") {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
