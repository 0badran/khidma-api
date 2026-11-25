import { Router } from "express";
import { z } from "zod";
import { ALLOWED_FORMATS, cloudinaryConfig, signParams } from "../../lib/cloudinary.js";
import { HttpError, forbidden } from "../../lib/errors.js";
import { parse } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/auth.js";

export const uploadsRouter = Router();

const bodySchema = z.object({ purpose: z.enum(["provider", "category", "logo", "banner"]) });

// The app uploads the file straight to Cloudinary with these signed parameters.
// The server never handles the image bytes, and the API secret never leaves the server.
uploadsRouter.post("/sign", requireAuth, (req, res) => {
  const { purpose } = parse(bodySchema, req.body);
  const auth = req.auth!;
  if (purpose === "provider" ? auth.role !== "provider" : auth.role !== "admin") throw forbidden();

  const cfg = cloudinaryConfig();
  if (!cfg) throw new HttpError(503, "errors.uploadsUnavailable");

  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string | number | boolean> = {
    allowed_formats: ALLOWED_FORMATS,
    folder: `khidma/${purpose}`,
    timestamp,
  };
  if (purpose === "provider") {
    // One photo per provider: uploading again replaces the old one.
    params.public_id = String(auth.id);
    params.overwrite = true;
    params.invalidate = true;
  }

  res.json({
    uploadUrl: `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`,
    apiKey: cfg.apiKey,
    signature: signParams(params, cfg.apiSecret),
    params,
  });
});
