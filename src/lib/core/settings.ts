/**
 * C1-10 — Settings core. The Setting table is a string map (`key` -> `value`).
 * This parser is the typed boundary: it reads the subset the core needs and
 * never throws on junk values (falls back to defaults), matching v1
 * `src/lib/settings.ts` semantics.
 */
export interface CoreSettings {
  branding: { appName?: string; companyName?: string; tagline?: string; accentColor?: string; logoUrl?: string } | null;
  activeDepartments: string[] | null;
  requireMillCerts: boolean;
  countTolerance: number;
  onboardingComplete: boolean;
  onboardingSkipped: boolean;
}

function parseIntSafe(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseBool(raw: string | undefined): boolean {
  return String(raw ?? "").trim() === "true";
}

function parseJsonArray(raw: string | undefined): string[] | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map(String).filter((x) => x.trim().length > 0);
    return null;
  } catch {
    return null;
  }
}

function parseBranding(raw: string | undefined): CoreSettings["branding"] {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Record<string, unknown>;
    if (typeof parsed !== "object" || parsed === null) return null;
    const out: CoreSettings["branding"] = {};
    for (const key of ["appName", "companyName", "tagline", "accentColor", "logoUrl"] as const) {
      const v = parsed[key];
      if (typeof v === "string" && v.trim()) out[key] = v.trim();
    }
    return out;
  } catch {
    return null;
  }
}

export function parseSettings(rows: ReadonlyMap<string, string>): CoreSettings {
  const get = (k: string) => rows.get(k);

  return {
    branding: parseBranding(get("branding")),
    activeDepartments: parseJsonArray(get("activeDepartments")),
    requireMillCerts: parseBool(get("requireMillCerts")),
    countTolerance: parseIntSafe(get("count_tolerance"), 0),
    onboardingComplete: parseBool(get("onboardingComplete")),
    onboardingSkipped: parseBool(get("onboardingSkipped")),
  };
}
