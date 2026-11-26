import { Router } from "express";
import { and, asc, eq, or, type AnyColumn } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { cities, governorates } from "../../db/schema.js";
import { notFound } from "../../lib/errors.js";
import { containsFolded } from "../../lib/search.js";
import { parse } from "../../lib/validate.js";

export const locationsRouter = Router();

const searchQuery = z.object({ q: z.string().trim().min(1).optional() });

// Matches the Arabic or English name.
const nameMatch = (nameAr: AnyColumn, nameEn: AnyColumn, q: string) =>
  or(containsFolded(nameAr, q), containsFolded(nameEn, q));

const cityColumns = {
  id: cities.id,
  governorateId: cities.governorateId,
  nameAr: cities.nameAr,
  nameEn: cities.nameEn,
};

// All governorates, in dataset order. Optional ?q= filters by name.
locationsRouter.get("/governorates", async (req, res) => {
  const { q } = parse(searchQuery, req.query);
  const rows = await db
    .select()
    .from(governorates)
    .where(q ? nameMatch(governorates.nameAr, governorates.nameEn, q) : undefined)
    .orderBy(asc(governorates.id));
  res.json({ governorates: rows });
});

// Cities across all governorates, with the governorate name on each row.
// Optional ?q= filters by name, ?id= returns one city, ?governorateId= narrows to one governorate, ?limit= caps the rows (default 50, max 100).
const citiesQuery = z.object({
  q: z.string().trim().min(1).optional(),
  id: z.coerce.number().int().positive().optional(),
  governorateId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

locationsRouter.get("/cities", async (req, res) => {
  const { q, id, governorateId, limit } = parse(citiesQuery, req.query);
  const rows = await db
    .select({
      ...cityColumns,
      governorateNameAr: governorates.nameAr,
      governorateNameEn: governorates.nameEn,
    })
    .from(cities)
    .innerJoin(governorates, eq(governorates.id, cities.governorateId))
    .where(
      and(
        id ? eq(cities.id, id) : undefined,
        governorateId ? eq(cities.governorateId, governorateId) : undefined,
        q ? nameMatch(cities.nameAr, cities.nameEn, q) : undefined,
      ),
    )
    .orderBy(asc(cities.governorateId), asc(cities.id))
    .limit(limit);
  res.json({ cities: rows });
});

// Cities of one governorate. Optional ?q= filters by name.
locationsRouter.get("/governorates/:id/cities", async (req, res) => {
  const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
  const { q } = parse(searchQuery, req.query);
  const [gov] = await db.select().from(governorates).where(eq(governorates.id, id));
  if (!gov) throw notFound();
  const rows = await db.select(cityColumns).from(cities).where(and(eq(cities.governorateId, id), q ? nameMatch(cities.nameAr, cities.nameEn, q) : undefined)).orderBy(asc(cities.id));
  res.json({ governorate: gov, cities: rows });
});
