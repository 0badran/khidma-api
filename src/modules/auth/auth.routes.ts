import { Router } from "express";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { categories, otpCodes, providers, users } from "../../db/schema.js";
import { HttpError, badRequest, conflict, unauthorized } from "../../lib/errors.js";
import { sendOtpEmail } from "../../lib/mailer.js";
import { createToken, generateOtp, hashOtp, hashPassword, verifyPassword } from "../../lib/security.js";
import { parse, phoneRegex } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/auth.js";
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
    .where(eq(otpCodes.email, email))
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

const registerSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("customer"),
    name: z.string().trim().min(2).max(100),
    phone: phoneSchema,
    email: emailSchema,
    password: z.string().min(8).max(128),
    birthDate: z.iso.date(),
    otp: z.string().regex(/^\d{6}$/),
  }),
  z.object({
    role: z.literal("provider"),
    name: z.string().trim().min(2).max(100),
    phone: phoneSchema,
    email: emailSchema,
    password: z.string().min(8).max(128),
    birthDate: z.iso.date(),
    otp: z.string().regex(/^\d{6}$/),
    categoryId: z.number().int().positive(),
    city: z.string().trim().min(2).max(100),
    photoUrl: z.url().optional(),
  }),
]);

authRouter.post("/register", async (req, res) => {
  const body = parse(registerSchema, req.body);

  const [otp] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, body.email),
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
  }

  const passwordHash = await hashPassword(body.password);
  const user = await db.transaction(async (tx) => {
    await tx.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, otp.id));
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
        city: body.city,
        photoUrl: body.photoUrl,
      });
    }
    return created;
  });

  res.status(201).json({ token: createToken({ sub: user.id, role: user.role }), user });
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
    token: createToken({ sub: user.id, role: user.role }),
    user: { id: user.id, role: user.role, name: user.name },
    message: restored ? req.t("messages.accountRestored") : undefined,
  });
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
  res.json({ user });
});

// Deleting an account hides it. It is purged after 30 days without sign-in.
authRouter.delete("/me", requireAuth, async (req, res) => {
  if (req.auth!.role === "admin") throw new HttpError(403, "errors.forbidden");
  await db.update(users).set({ hiddenAt: new Date() }).where(eq(users.id, req.auth!.id));
  res.json({ message: req.t("messages.accountHidden") });
});
