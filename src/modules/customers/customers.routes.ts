import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { cities, users } from "../../db/schema.js";
import { badRequest } from "../../lib/errors.js";
import { parse } from "../../lib/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const customersRouter = Router();

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    birthDate: z.iso.date().nullable(),
    cityId: z.number().int().positive().nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0);

customersRouter.patch("/me", requireAuth, requireRole("customer"), async (req, res) => {
  const body = parse(updateSchema, req.body);
  if (body.cityId) {
    const [city] = await db.select({ id: cities.id }).from(cities).where(eq(cities.id, body.cityId));
    if (!city) throw badRequest("errors.cityNotFound");
  }
  await db.update(users).set(body).where(eq(users.id, req.auth!.id));
  res.json({ ok: true });
});
