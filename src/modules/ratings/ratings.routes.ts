import { Router } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { providers, ratings, users } from "../../db/schema.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { parse, phoneRegex } from "../../lib/validate.js";
import { optionalAuth } from "../../middleware/auth.js";

export const ratingsRouter = Router({ mergeParams: true });

const idSchema = z.coerce.number().int().positive();

async function findVisibleProvider(id: number) {
  const [row] = await db
    .select({ id: providers.userId, phone: users.phone })
    .from(providers)
    .innerJoin(users, eq(users.id, providers.userId))
    .where(and(eq(providers.userId, id), eq(providers.isActive, true), isNull(users.hiddenAt)));
  if (!row) throw notFound("errors.providerNotFound");
  return row;
}

ratingsRouter.get("/", async (req, res) => {
  const providerId = parse(idSchema, (req.params as { id?: string }).id);
  await findVisibleProvider(providerId);
  const rows = await db
    .select({
      id: ratings.id,
      raterName: ratings.raterName,
      stars: ratings.stars,
      comment: ratings.comment,
      createdAt: ratings.createdAt,
    })
    .from(ratings)
    .where(eq(ratings.providerId, providerId))
    .orderBy(desc(ratings.createdAt))
    .limit(100);
  res.json({ ratings: rows });
});

const guestSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().regex(phoneRegex).optional(),
});

ratingsRouter.post("/", optionalAuth, async (req, res) => {
  const providerId = parse(idSchema, (req.params as { id?: string }).id);
  const provider = await findVisibleProvider(providerId);
  const body = parse(guestSchema, req.body);

  let raterName = body.name;
  let raterPhone = body.phone;
  let userId: number | null = null;
  if (req.auth && req.auth.role !== "admin") {
    const [user] = await db.select().from(users).where(eq(users.id, req.auth.id));
    if (user) {
      raterName = user.name;
      raterPhone = user.phone;
      userId = user.id;
    }
  }
  if (!raterName || !raterPhone) throw badRequest("errors.validation");
  if (raterPhone === provider.phone) throw badRequest("errors.forbidden");

  try {
    const [created] = await db
      .insert(ratings)
      .values({ providerId, userId, raterName, raterPhone, stars: body.stars, comment: body.comment })
      .returning({ id: ratings.id });
    res.status(201).json({ id: created?.id });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict("errors.alreadyRated");
    throw err;
  }
});

function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  while (current && typeof current === "object") {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
