/**
 * C1-3 — Typed body/query parsing at the API edge.
 * Returns a typed Result instead of throwing; every POST/PATCH on v2 routes
 * uses this (repo precedent: src/lib/validate.ts parseOr400, zod v4).
 */
import { z } from "zod";
import { ok, err, type Result } from "./result";
import { validation, type AppError } from "./errors";

interface Issue {
  path: string;
  message: string;
}

export function parseOr400<T>(
  schema: z.ZodType<T>,
  input: unknown,
): Result<T, AppError> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  const fields: Issue[] = parsed.error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  return err(validation("Invalid request", { fields }));
}
