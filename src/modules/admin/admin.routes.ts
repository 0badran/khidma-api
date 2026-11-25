import { Router } from "express";
import { asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { banners, categories, cities, providers, users } from "../../db/schema.js";
import { ageExpr } from "../../lib/age.js";
import { conflict, notFound } from "../../lib/errors.js";
import { parse } from "../../lib/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { clearSetting, getPublicSettings, setSetting, setTheme } from "../settings/settings.service.js";
import { themeInputSchema } from "../settings/theme.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("admin"));

const idSchema = z.coerce.number().int().positive();
const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const categorySchema = z.object({
  nameAr: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().min(1).max(100),
  imageUrl: z.url().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

adminRouter.post("/categories", async (req, res) => {
  const body = parse(categorySchema, req.body);
  const [created] = await db.insert(categories).values(body).returning();
  res.status(201).json({ category: created });
});

adminRouter.patch("/categories/:id", async (req, res) => {
  const id = parse(idSchema, req.params.id);
  const body = parse(categorySchema.partial().refine((v) => Object.keys(v).length > 0), req.body);
  const [updated] = await db.update(categories).set(body).where(eq(categories.id, id)).returning();
  if (!updated) throw notFound("errors.categoryNotFound");
  res.json({ category: updated });
});

adminRouter.delete("/categories/:id", async (req, res) => {
  const id = parse(idSchema, req.params.id);
  const [used] = await db.select({ n: count() }).from(providers).where(eq(providers.categoryId, id));
  if (used && used.n > 0) throw conflict();
  const [deleted] = await db.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id });
  if (!deleted) throw notFound("errors.categoryNotFound");
  res.json({ ok: true });
});

const bannerSchema = z.object({
  imageUrl: z.url(),
  titleAr: z.string().trim().min(1).max(150).nullable().optional(),
  titleEn: z.string().trim().min(1).max(150).nullable().optional(),
  linkUrl: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

adminRouter.get("/banners", async (_req, res) => {
  const rows = await db.select().from(banners).orderBy(asc(banners.sortOrder), asc(banners.id));
  res.json({ banners: rows });
});

adminRouter.post("/banners", async (req, res) => {
  const body = parse(bannerSchema, req.body);
  const [created] = await db.insert(banners).values(body).returning();
  res.status(201).json({ banner: created });
});

adminRouter.patch("/banners/:id", async (req, res) => {
  const id = parse(idSchema, req.params.id);
  const body = parse(bannerSchema.partial().refine((v) => Object.keys(v).length > 0), req.body);
  const [updated] = await db.update(banners).set(body).where(eq(banners.id, id)).returning();
  if (!updated) throw notFound("errors.bannerNotFound");
  res.json({ banner: updated });
});

adminRouter.delete("/banners/:id", async (req, res) => {
  const id = parse(idSchema, req.params.id);
  const [deleted] = await db.delete(banners).where(eq(banners.id, id)).returning({ id: banners.id });
  if (!deleted) throw notFound("errors.bannerNotFound");
  res.json({ ok: true });
});

adminRouter.get("/providers", async (req, res) => {
  const { page, limit } = parse(pageSchema, req.query);
  const rows = await db
    .select({
      id: providers.userId,
      name: users.name,
      phone: users.phone,
      email: users.email,
      age: ageExpr,
      cityId: providers.cityId,
      cityNameAr: cities.nameAr,
      cityNameEn: cities.nameEn,
      governorateId: cities.governorateId,
      categoryId: providers.categoryId,
      photoUrl: providers.photoUrl,
      yearsOfExperience: providers.yearsOfExperience,
      bio: providers.bio,
      isActive: providers.isActive,
      hiddenAt: users.hiddenAt,
    })
    .from(providers)
    .innerJoin(users, eq(users.id, providers.userId))
    .leftJoin(cities, eq(cities.id, providers.cityId))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  res.json({ providers: rows, page, limit });
});

adminRouter.patch("/providers/:id/active", async (req, res) => {
  const id = parse(idSchema, req.params.id);
  const { isActive } = parse(z.object({ isActive: z.boolean() }), req.body);
  const [updated] = await db
    .update(providers)
    .set({ isActive })
    .where(eq(providers.userId, id))
    .returning({ id: providers.userId });
  if (!updated) throw notFound("errors.providerNotFound");
  res.json({ ok: true });
});

adminRouter.get("/customers", async (req, res) => {
  const { page, limit } = parse(pageSchema, req.query);
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      email: users.email,
      age: ageExpr,
      hiddenAt: users.hiddenAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.role, "customer"))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  res.json({ customers: rows, page, limit });
});

adminRouter.get("/settings", async (_req, res) => {
  res.json(await getPublicSettings());
});

const settingsSchema = z
  .object({
    appName: z.string().trim().min(1).max(100),
    logoUrl: z.url().nullable(),
    maintenanceMode: z.boolean(),
    theme: themeInputSchema,
  })
  .partial();

adminRouter.put("/settings", async (req, res) => {
  const body = parse(settingsSchema, req.body);
  if (body.appName !== undefined) await setSetting("app_name", body.appName);
  if (body.logoUrl === null) await clearSetting("logo_url");
  else if (body.logoUrl !== undefined) await setSetting("logo_url", body.logoUrl);
  if (body.maintenanceMode !== undefined) await setSetting("maintenance_mode", String(body.maintenanceMode));
  if (body.theme !== undefined) await setTheme(body.theme);
  res.json(await getPublicSettings());
});
