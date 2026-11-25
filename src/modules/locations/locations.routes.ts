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

// Cities of one governorate. Optional ?q= filters by name.
locationsRouter.get("/governorates/:id/cities", async (req, res) => {
  const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
  const { q } = parse(searchQuery, req.query);
  const [gov] = await db.select().from(governorates).where(eq(governorates.id, id));
  if (!gov) throw notFound();
  const rows = await db.select(cityColumns).from(cities).where(and(eq(cities.governorateId, id), q ? nameMatch(cities.nameAr, cities.nameEn, q) : undefined)).orderBy(asc(cities.id));
  res.json({ governorate: gov, cities: rows });
});
