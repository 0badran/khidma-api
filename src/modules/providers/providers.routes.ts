import { Router } from "express";
import { and, asc, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { AVATAR_PLACEHOLDER_URL } from "../../config/placeholders.js";
import { categories, cities, governorates, providers, ratings, users } from "../../db/schema.js";
import { ageExpr } from "../../lib/age.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { parse } from "../../lib/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const providersRouter = Router();

const stats = db
  .select({
    providerId: ratings.providerId,
    avg: sql<number>`round(avg(${ratings.stars})::numeric, 2)::float`.as("avg_rating"),
    count: sql<number>`count(*)::int`.as("ratings_count"),
  })
  .from(ratings)
  .groupBy(ratings.providerId)
  .as("stats");

const listQuery = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  cityId: z.coerce.number().int().positive().optional(),
  governorateId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const providerColumns = {
  id: providers.userId,
  name: users.name,
  age: ageExpr,
  cityId: providers.cityId,
  cityNameAr: cities.nameAr,
  cityNameEn: cities.nameEn,
  governorateId: cities.governorateId,
  governorateNameAr: governorates.nameAr,
  governorateNameEn: governorates.nameEn,
  photoUrl: sql<string>`coalesce(${providers.photoUrl}, ${AVATAR_PLACEHOLDER_URL}::text)`,
  yearsOfExperience: providers.yearsOfExperience,
  categoryId: providers.categoryId,
  categoryNameAr: categories.nameAr,
  categoryNameEn: categories.nameEn,
  avgRating: stats.avg,
  ratingsCount: sql<number>`coalesce(${stats.count}, 0)`,
};

// Only active, non-hidden providers are visible to the public.
const visible = and(eq(providers.isActive, true), isNull(users.hiddenAt));

providersRouter.get("/", async (req, res) => {
  const query = parse(listQuery, req.query);
  const where = and(
    visible,
    query.categoryId ? eq(providers.categoryId, query.categoryId) : undefined,
    query.cityId ? eq(providers.cityId, query.cityId) : undefined,
    query.governorateId ? eq(cities.governorateId, query.governorateId) : undefined,
    query.q ? ilike(users.name, `%${query.q}%`) : undefined,
  );
  const rows = await db
    .select(providerColumns)
    .from(providers)
    .innerJoin(users, eq(users.id, providers.userId))
    .innerJoin(categories, eq(categories.id, providers.categoryId))
    .leftJoin(cities, eq(cities.id, providers.cityId))
    .leftJoin(governorates, eq(governorates.id, cities.governorateId))
    .leftJoin(stats, eq(stats.providerId, providers.userId))
    .where(where)
    .orderBy(sql`${stats.avg} desc nulls last`, desc(sql`coalesce(${stats.count}, 0)`), asc(providers.userId))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);
  res.json({ providers: rows, page: query.page, limit: query.limit });
});

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    birthDate: z.iso.date(),
    cityId: z.number().int().positive(),
    categoryId: z.number().int().positive(),
    photoUrl: z.url().nullable(),
    yearsOfExperience: z.number().int().min(0).max(60).nullable(),
    bio: z.string().trim().max(1000).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0);

providersRouter.patch("/me", requireAuth, requireRole("provider"), async (req, res) => {
  const body = parse(updateSchema, req.body);
  const id = req.auth!.id;
  if (body.categoryId) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, body.categoryId));
    if (!category) throw badRequest("errors.categoryNotFound");
  }
  if (body.cityId) {
    const [city] = await db.select({ id: cities.id }).from(cities).where(eq(cities.id, body.cityId));
    if (!city) throw badRequest("errors.cityNotFound");
  }
  await db.transaction(async (tx) => {
    if (body.name !== undefined || body.birthDate !== undefined) {
      await tx
        .update(users)
        .set({ name: body.name, birthDate: body.birthDate })
        .where(eq(users.id, id));
    }
    const profile = {
      cityId: body.cityId,
      categoryId: body.categoryId,
      photoUrl: body.photoUrl,
      yearsOfExperience: body.yearsOfExperience,
      bio: body.bio,
    };
    if (Object.values(profile).some((v) => v !== undefined)) {
      await tx.update(providers).set(profile).where(eq(providers.userId, id));
    }
  });
  res.json({ ok: true });
});

providersRouter.get("/:id", async (req, res) => {
  const id = parse(z.coerce.number().int().positive(), req.params.id);
  const [row] = await db
    .select({ ...providerColumns, bio: providers.bio, phone: users.phone })
    .from(providers)
    .innerJoin(users, eq(users.id, providers.userId))
    .innerJoin(categories, eq(categories.id, providers.categoryId))
    .leftJoin(cities, eq(cities.id, providers.cityId))
    .leftJoin(governorates, eq(governorates.id, cities.governorateId))
    .leftJoin(stats, eq(stats.providerId, providers.userId))
    .where(and(visible, eq(providers.userId, id)));
  if (!row) throw notFound("errors.providerNotFound");
  const digits = row.phone.replace(/\D/g, "");
  res.json({
    provider: { ...row, callUrl: `tel:${row.phone}`, whatsappUrl: `https://wa.me/${digits}` },
  });
});
