/**
 * C12 — System Terminology Engine (DEPTH_02 §4, DEPTH_03 F12).
 * Pure & DB-free engine allowing precision manufacturing enterprises
 * to customize system terminology (e.g. "Quotation" -> "Job Estimate")
 * while guaranteeing fallback to standard canonical terms.
 */

export type TerminologyKey =
  | "quotation"
  | "work_order"
  | "ncr"
  | "customer"
  | "purchase_order"
  | "operator"
  | "shift"
  | "bom"
  | "eco"
  | "fai";

export type TerminologyMap = Partial<Record<TerminologyKey | string, string>>;

export const DEFAULT_TERMINOLOGY: Record<TerminologyKey, string> = {
  quotation: "Quotation",
  work_order: "Work Order",
  ncr: "NCR",
  customer: "Customer",
  purchase_order: "Purchase Order",
  operator: "Operator",
  shift: "Shift",
  bom: "Bill of Materials",
  eco: "Engineering Change Order",
  fai: "First Article Inspection",
};

export function resolveTerminology(
  customMap: TerminologyMap | null | undefined,
  key: TerminologyKey | string,
): string {
  if (customMap && typeof customMap[key] === "string" && customMap[key]!.trim().length > 0) {
    return customMap[key]!.trim();
  }

  if (key in DEFAULT_TERMINOLOGY) {
    return DEFAULT_TERMINOLOGY[key as TerminologyKey];
  }

  // Capitalize snake_case key as graceful fallback
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export interface TerminologyValidationResult {
  valid: boolean;
  sanitized?: Record<string, string>;
  error?: string;
}

export function validateTerminologyOverrides(
  input: unknown,
): TerminologyValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: false, error: "Terminology overrides must be a key-value object." };
  }

  const inputObj = input as Record<string, unknown>;
  const sanitized: Record<string, string> = {};

  for (const [k, v] of Object.entries(inputObj)) {
    if (typeof v !== "string") {
      return {
        valid: false,
        error: `Terminology value for key '${k}' must be strings.`,
      };
    }

    const trimmed = v.trim();
    if (trimmed.length === 0) {
      continue; // Skip empty
    }

    if (trimmed.length > 100) {
      return {
        valid: false,
        error: `Terminology value for key '${k}' exceeds 100 characters limit.`,
      };
    }

    sanitized[k] = trimmed;
  }

  return { valid: true, sanitized };
}
