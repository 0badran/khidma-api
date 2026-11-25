import { createHash } from "node:crypto";
import { env } from "../config/env.js";

export const ALLOWED_FORMATS = "jpg,jpeg,png,webp";

// Cloudinary signs the request parameters sorted by name, joined as name=value with "&",
// with the API secret appended, hashed with SHA-1 (hex).
export function signParams(params: Record<string, string | number | boolean>, secret: string): string {
  const base = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(base + secret).digest("hex");
}

export function cloudinaryConfig() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return null;
  return { cloudName: CLOUDINARY_CLOUD_NAME, apiKey: CLOUDINARY_API_KEY, apiSecret: CLOUDINARY_API_SECRET };
}
