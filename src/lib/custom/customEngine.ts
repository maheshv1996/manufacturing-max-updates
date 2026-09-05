/**
 * C12 — Custom Entity & Record Validation Engine (DEPTH_03 F12).
 * Pure & DB-free low-code schema engine that validates dynamic JSON
 * record payloads against user-defined field definitions.
 */
import { ok, err, type Result } from "../core/result";
import { validation, type AppError } from "../core/errors";

export type CustomFieldType = "text" | "number" | "date" | "select" | "boolean";

export interface CustomFieldDefinition {
  key: string;
  label: string;
  fieldType: CustomFieldType | string;
  required?: boolean;
  options?: readonly string[] | null;
  placeholder?: string | null;
  defaultValue?: unknown;
}

export function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || `entity_${Date.now()}`
  );
}

export function validateCustomRecordValues(
  fields: readonly CustomFieldDefinition[],
  rawInput: unknown,
): Result<Record<string, unknown>, AppError> {
  if (typeof rawInput !== "object" || rawInput === null || Array.isArray(rawInput)) {
    return err(validation("Custom record values must be a JSON object"));
  }

  const inputObj = rawInput as Record<string, unknown>;
  const validated: Record<string, unknown> = {};

  for (const field of fields) {
    const val = inputObj[field.key];

    // Check required presence
    if (val === undefined || val === null || val === "") {
      if (field.required) {
        return err(
          validation(`Field '${field.label}' (${field.key}) is required and cannot be empty.`),
        );
      }
      continue;
    }

    // Type checking
    switch (field.fieldType) {
      case "text": {
        if (typeof val !== "string") {
          return err(validation(`Field '${field.label}' must be a string.`));
        }
        validated[field.key] = val.trim();
        break;
      }

      case "number": {
        if (typeof val !== "number" || !Number.isFinite(val)) {
          return err(validation(`Field '${field.label}' must be a valid finite number.`));
        }
        validated[field.key] = val;
        break;
      }

      case "date": {
        if (typeof val !== "string" && !(val instanceof Date)) {
          return err(validation(`Field '${field.label}' must be a valid ISO date string.`));
        }
        const d = new Date(val);
        if (Number.isNaN(d.getTime())) {
          return err(validation(`Field '${field.label}' contains an invalid date value.`));
        }
        validated[field.key] = d.toISOString();
        break;
      }

      case "select": {
        if (typeof val !== "string") {
          return err(validation(`Field '${field.label}' must be a string selection.`));
        }
        const allowedOptions = Array.isArray(field.options) ? field.options : [];
        if (!allowedOptions.includes(val)) {
          return err(
            validation(
              `Field '${field.label}' (${field.key}) value '${val}' is not in allowed options: [${allowedOptions.join(", ")}].`,
            ),
          );
        }
        validated[field.key] = val;
        break;
      }

      case "boolean": {
        if (typeof val !== "boolean") {
          return err(validation(`Field '${field.label}' must be a boolean (true/false).`));
        }
        validated[field.key] = val;
        break;
      }

      default:
        validated[field.key] = val;
    }
  }

  return ok(validated);
}
