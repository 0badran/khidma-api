import { Router } from "express";
import { asc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { categories } from "../../db/schema.js";

export const categoriesRouter = Router();

categoriesRouter.get("/", async (_req, res) => {
  const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id));
  res.json({ categories: rows });
});
