import express from "express";
import { i18nMiddleware } from "./i18n/index.js";
import { errorHandler } from "./middleware/error.js";
import { maintenanceGuard } from "./middleware/maintenance.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { categoriesRouter } from "./modules/categories/categories.routes.js";
import { customersRouter } from "./modules/customers/customers.routes.js";
import { providersRouter } from "./modules/providers/providers.routes.js";
import { ratingsRouter } from "./modules/ratings/ratings.routes.js";
import { uploadsRouter } from "./modules/uploads/uploads.routes.js";
import { settingsRouter } from "./modules/settings/settings.routes.js";

export const app = express();

app.use(express.json({ limit: "100kb" }));
app.use(i18nMiddleware);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(maintenanceGuard);
app.use("/api/auth", authRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/providers/:id/ratings", ratingsRouter);
app.use("/api/providers", providersRouter);
app.use("/api/customers", customersRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/admin", adminRouter);

app.use(errorHandler);
