import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { cities, governorates } from "../../db/schema.js";
import { notFound } from "../../lib/errors.js";
import { parse } from "../../lib/validate.js";

export const locationsRouter = Router();

const cityColumns = {
  id: cities.id,
  governorateId: cities.governorateId,
  nameAr: cities.nameAr,
  nameEn: cities.nameEn,
};

// All governorates, in dataset order.
locationsRouter.get("/governorates", async (_req, res) => {
  const rows = await db.select().from(governorates).orderBy(asc(governorates.id));
  res.json({ governorates: rows });
});

// Cities of one governorate.
locationsRouter.get("/governorates/:id/cities", async (req, res) => {
  const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
  const [gov] = await db.select().from(governorates).where(eq(governorates.id, id));
  if (!gov) throw notFound();
  const rows = await db.select(cityColumns).from(cities).where(eq(cities.governorateId, id)).orderBy(asc(cities.id));
  res.json({ governorate: gov, cities: rows });
});

// All cities, optionally of one governorate.
locationsRouter.get("/cities", async (req, res) => {
  const query = parse(z.object({ governorateId: z.coerce.number().int().positive().optional() }), req.query);
  const q = db.select(cityColumns).from(cities);
  const rows = await (query.governorateId ? q.where(eq(cities.governorateId, query.governorateId)) : q).orderBy(
    asc(cities.governorateId),
    asc(cities.id),
  );
  res.json({ cities: rows });
});
