import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { banners } from "../../db/schema.js";

export const bannersRouter = Router();

// Public: the active hero banners, in display order.
bannersRouter.get("/", async (_req, res) => {
  const rows = await db
    .select({
      id: banners.id,
      imageUrl: banners.imageUrl,
      titleAr: banners.titleAr,
      titleEn: banners.titleEn,
      linkUrl: banners.linkUrl,
      sortOrder: banners.sortOrder,
    })
    .from(banners)
    .where(eq(banners.isActive, true))
    .orderBy(asc(banners.sortOrder), asc(banners.id));
  res.json({ banners: rows });
});
