import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { parse } from "../../lib/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const customersRouter = Router();

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    birthDate: z.iso.date(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0);

customersRouter.patch("/me", requireAuth, requireRole("customer"), async (req, res) => {
  const body = parse(updateSchema, req.body);
  await db.update(users).set(body).where(eq(users.id, req.auth!.id));
  res.json({ ok: true });
});
