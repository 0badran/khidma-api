import type { z } from "zod";

export class ValidationError extends Error {
  constructor(public fields: Record<string, string[]>) {
    super("validation");
  }
}

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    (fields[key] ??= []).push(issue.message);
  }
  throw new ValidationError(fields);
}

export const phoneRegex = /^\+?\d{8,15}$/;
