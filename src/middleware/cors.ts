import type { RequestHandler } from "express";
import { env } from "../config/env.js";

const allowed = (env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

// The API uses a Bearer token, not cookies, so credentials are not allowed
// and a wildcard is safe when no origin list is set.
export const cors: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    if (allowed.length === 0) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (allowed.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.append("Vary", "Origin");
    }
  }
  if (req.method === "OPTIONS" && req.headers["access-control-request-method"]) {
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      req.headers["access-control-request-headers"] ?? "Authorization,Content-Type,Accept-Language",
    );
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
    return;
  }
  next();
};
