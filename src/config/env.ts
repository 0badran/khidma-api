import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  // Comma-separated browser origins allowed to call the API. Unset allows any origin (no cookies).
  CORS_ORIGINS: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  GMAIL_CLIENT_ID: z.string().min(1).optional(),
  GMAIL_CLIENT_SECRET: z.string().min(1).optional(),
  GMAIL_REFRESH_TOKEN: z.string().min(1).optional(),
  GMAIL_SENDER: z.email().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
});

export const env = schema.parse(process.env);
