import { Router } from "express";
import { getPublicSettings } from "./settings.service.js";

export const settingsRouter = Router();

settingsRouter.get("/public", async (_req, res) => {
  res.json(await getPublicSettings());
});
