import type { ErrorRequestHandler } from "express";
import { HttpError } from "../lib/errors.js";
import { ValidationError } from "../lib/validate.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: { message: req.t("errors.validation"), fields: err.fields } });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: req.t(err.messageKey) } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { message: req.t("errors.internal") } });
};
