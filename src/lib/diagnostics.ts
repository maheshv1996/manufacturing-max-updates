/**
 * Local diagnostics capture — the offline-first replacement for a hosted error
 * tracker.
 *
 * Manufacturing Max ships on-premises, frequently into air-gapped or
 * security-reviewed networks. An agent that POSTs stack traces to a third-party
 * endpoint is a finding on a customer security questionnaire, so nothing here
 * ever opens a socket. Errors land in a bounded in-process ring buffer; an
 * administrator exports them as a single JSON bundle and can read every byte
 * before deciding to send it anywhere.
 *
 * Two rules make that promise real, and both are enforced by tests:
 *
 *   1. Environment reporting is an ALLOWLIST. A denylist fails open — the next
 *      person to add MFGMAX_NEW_SECRET would leak it by default.
 *   2. Every payload is redacted on the way IN, not on the way out. A bundle
 *      cannot leak a token that was never stored.
 *
 * The module is deliberately dependency-free and side-effect-free on import so
 * it can be unit-tested under `node --test` and imported from either runtime.
 */

export type DiagnosticLevel = "error" | "warn" | "info";
export type DiagnosticSource = "server" | "client";

export interface DiagnosticEntry {
  /** ISO 8601, assigned at capture time. */
  at: string;
  level: DiagnosticLevel;
  source: DiagnosticSource;
  /** Subsystem or React component that reported it. */
  component: string;
  action?: string;
  message: string;
  stack?: string;
  meta?: Record<string, unknown>;
}

export interface DiagnosticInput {
  level?: DiagnosticLevel;
  source?: DiagnosticSource;
  component?: string;
  action?: string;
  message?: unknown;
  stack?: unknown;
  meta?: unknown;
}

/** Hard caps. A diagnostics buffer that can exhaust memory is a new outage. */
export const LIMITS = {
  maxEntries: 500,
  maxMessageChars: 2_000,
  maxStackChars: 4_000,
  maxMetaDepth: 4,
  maxMetaKeys: 40,
  maxStringChars: 500,
} as const;

export const REDACTED = "[redacted]";

/**
 * Keys whose VALUES are never recorded, matched case-insensitively as a
 * substring so `dbPassword`, `X-Api-Key` and `refresh_token` are all caught.
 */
const SECRET_KEY_PATTERN =
  /pass|pwd|secret|token|api[-_ ]?key|apikey|authorization|auth[-_]?header|cookie|credential|private[-_]?key|passphrase|signature|\bdsn\b|\botp\b|\bpin\b|\bhash\b|salt/i;

/** Values that are self-evidently credentials regardless of the key they sit under. */
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /^Bearer\s+\S+/i,
  /^Basic\s+\S+/i,
  /^ey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./, // JWT
  /^sk-[A-Za-z0-9_-]{16,}/, // OpenAI-style
  /^gsk_[A-Za-z0-9_-]{16,}/, // Groq
  /^AIza[A-Za-z0-9_-]{20,}/, // Google
  /^rzp_(test|live)_[A-Za-z0-9]{8,}/, // Razorpay
  /^re_[A-Za-z0-9_-]{16,}/, // Resend
  /^ghp_[A-Za-z0-9]{20,}/, // GitHub PAT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

/** `postgresql://user:pw@host:5432/db` — keep the host and database, drop the credentials. */
const CONNECTION_STRING_INLINE = /([a-z][a-z0-9+.-]*:\/\/)([^/@\s]+@)/gi;

/**
 * Environment variables safe to report verbatim. Operational switches and model
 * names only — no paths (they embed the OS username), no endpoints, no secrets.
 * ALLOWLIST BY DESIGN: adding a new secret must not require editing this file.
 */
export const ENV_VALUE_ALLOWLIST = [
  "NODE_ENV",
  "NEXT_RUNTIME",
  "DESKTOP_MODE",
  "PORT",
  "APP_VERSION",
  "AUTH_ENABLED",
  "DB_POOL_MAX",
  "SESSION_EXPIRATION",
  "BUILD_MONITOR_INTERVAL_MS",
  "GEMINI_MODEL",
  "GROQ_MODEL",
  "OLLAMA_MODEL",
  "MFGMAX_START_ON_BOOT",
  "DEFAULT_PLANT_ID",
  "UPDATE_MARKER",
] as const;

/**
 * Variables reported as configured/unset only. "Is the license secret set?" is
 * the diagnostically useful half of the question; the value never is.
 */
export const ENV_PRESENCE_ONLY = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "CRON_SECRET",
  "BACKUP_DIR",
  "LOG_DIR",
  "MFGMAX_DATA_DIR",
  "MFGMAX_APP_ROOT",
  "MFGMAX_RESOURCES_DIR",
  "POSTGRES_BIN_DIR",
  "MFGMAX_LICENSE",
  "MFGMAX_LICENSE_SECRET",
  "MFGMAX_LICENSE_SERVER",
  "MFGMAX_CONTROL_TOKEN",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "OLLAMA_BASE_URL",
  "RESEND_API_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "ADMIN_USER",
  "ADMIN_PASSWORD",
  "OPERATOR_USER",
  "OPERATOR_PASSWORD",
  "GITHUB_UPDATE_REPO",
  "NEXT_PUBLIC_APP_URL",
] as const;

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}… [+${s.length - max} chars]`;
}

/** True if a string is self-evidently a credential, whatever key it sits under. */
export function looksSecret(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((re) => re.test(value));
}

/** Masks credentials inside a URI but keeps host and path, which are diagnostic. */
export function redactConnectionString(value: string): string {
  return value.replace(CONNECTION_STRING_INLINE, `$1${REDACTED}@`);
}

const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

const INLINE_SECRETS: RegExp[] = [
  /\bey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_.-]*/g,
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bgsk_[A-Za-z0-9_-]{16,}\b/g,
  /\bAIza[A-Za-z0-9_-]{20,}\b/g,
  /\brzp_(test|live)_[A-Za-z0-9]{8,}\b/g,
  /\bre_[A-Za-z0-9_-]{16,}\b/g,
  /\bghp_[A-Za-z0-9]{20,}\b/g,
  /\bBearer\s+\S+/gi,
  /\bBasic\s+\S+/gi,
];

function redactInlineSecrets(value: string): string {
  let res = value;
  for (const re of INLINE_SECRETS) {
    res = res.replace(re, REDACTED);
  }
  return res;
}

/** `jane.doe@acme.co.in` -> `j***@acme.co.in`. Keeps the domain, drops the person. */
export function maskEmails(value: string): string {
  return value.replace(EMAIL, (_all, first: string, domain: string) => `${first}***${domain}`);
}

function redactString(value: string, max: number = LIMITS.maxStringChars): string {
  if (looksSecret(value)) return REDACTED;
  const scrubbed = redactInlineSecrets(maskEmails(redactConnectionString(value)));
  return truncate(scrubbed, max);
}

/**
 * Recursively strips credentials from an arbitrary payload. Redacts on key name
 * first (cheap and catches values that look innocuous), then on value shape.
 */
export function redactValue(value: unknown, key = "", depth = 0): unknown {
  if (key && SECRET_KEY_PATTERN.test(key)) return REDACTED;
  if (value === null || value === undefined) return value;

  const t = typeof value;
  if (t === "string") return redactString(value as string);
  if (t === "number" || t === "boolean") return value;
  if (t === "bigint") return `${(value as bigint).toString()}n`;
  if (t === "function" || t === "symbol") return `[${t}]`;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "[invalid date]" : value.toISOString();
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message, LIMITS.maxMessageChars),
      stack: value.stack ? redactString(value.stack, LIMITS.maxStackChars) : undefined,
    };
  }

  if (depth >= LIMITS.maxMetaDepth) return "[depth limit]";

  if (Array.isArray(value)) {
    const head = value.slice(0, LIMITS.maxMetaKeys).map((v) => redactValue(v, "", depth + 1));
    if (value.length > LIMITS.maxMetaKeys) head.push(`[+${value.length - LIMITS.maxMetaKeys} more]`);
    return head;
  }

  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (n >= LIMITS.maxMetaKeys) {
      out["__truncated"] = "[key limit]";
      break;
    }
    out[k] = redactValue(v, k, depth + 1);
    n++;
  }
  return out;
}

export interface EnvSnapshot {
  /** Allowlisted, non-sensitive values, verbatim. */
  values: Record<string, string>;
  /** Sensitive or path-bearing variables, reported as set / not set only. */
  configured: Record<string, boolean>;
  /** How many other variables exist. A count, never a name. */
  unrecognisedCount: number;
}

export function environmentSnapshot(
  env: Record<string, string | undefined> = process.env,
): EnvSnapshot {
  const values: Record<string, string> = {};
  for (const key of ENV_VALUE_ALLOWLIST) {
    const v = env[key];
    if (typeof v === "string" && v !== "") values[key] = truncate(v, 120);
  }

  const configured: Record<string, boolean> = {};
  for (const key of ENV_PRESENCE_ONLY) {
    configured[key] = typeof env[key] === "string" && env[key] !== "";
  }

  const known = new Set<string>([...ENV_VALUE_ALLOWLIST, ...ENV_PRESENCE_ONLY]);
  const unrecognisedCount = Object.keys(env).filter((k) => !known.has(k)).length;

  return { values, configured, unrecognisedCount };
}

// ---------------------------------------------------------------------------
// Bounded ring buffer. Module-scoped on purpose: one buffer per server process,
// which is the correct granularity for a single-tenant on-prem install.
// ---------------------------------------------------------------------------

const buffer: DiagnosticEntry[] = [];
let dropped = 0;

function coerceText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (v instanceof Error) return v.message;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v) ?? "";
  } catch {
    return "[unserialisable]";
  }
}

/** Captures one diagnostic. Never throws, never blocks, never leaves the process. */
export function recordDiagnostic(input: DiagnosticInput = {}): DiagnosticEntry {
  const level: DiagnosticLevel =
    input.level === "warn" || input.level === "info" ? input.level : "error";

  const entry: DiagnosticEntry = {
    at: new Date().toISOString(),
    level,
    source: input.source === "client" ? "client" : "server",
    component: redactString(coerceText(input.component) || "App", 80),
    message: redactString(coerceText(input.message) || "Unknown error", LIMITS.maxMessageChars),
  };

  const action = coerceText(input.action);
  if (action) entry.action = redactString(action, 120);

  const stack = coerceText(input.stack);
  if (stack) entry.stack = redactString(stack, LIMITS.maxStackChars);

  const meta = redactValue(input.meta, "meta");
  if (meta && typeof meta === "object" && Object.keys(meta).length > 0) {
    entry.meta = meta as Record<string, unknown>;
  }

  buffer.push(entry);
  while (buffer.length > LIMITS.maxEntries) {
    buffer.shift();
    dropped++;
  }
  return entry;
}

/** Newest-last snapshot of the buffer. Returns a copy — callers cannot mutate it. */
export function getDiagnostics(): DiagnosticEntry[] {
  return buffer.slice();
}

/** Empties the buffer. Exposed so an admin can reset after exporting a bundle. */
export function clearDiagnostics(): void {
  buffer.length = 0;
  dropped = 0;
}

export interface DiagnosticSummary {
  total: number;
  /** Entries evicted by the cap since the last clear. Non-zero means gaps. */
  dropped: number;
  capacity: number;
  byLevel: Record<DiagnosticLevel, number>;
  bySource: Record<DiagnosticSource, number>;
  /** Noisiest components first, at most ten. The aggregate signal, no egress. */
  topComponents: { component: string; count: number }[];
  oldestAt: string | null;
  newestAt: string | null;
}

export function summarizeDiagnostics(): DiagnosticSummary {
  const byLevel: Record<DiagnosticLevel, number> = { error: 0, warn: 0, info: 0 };
  const bySource: Record<DiagnosticSource, number> = { server: 0, client: 0 };
  const counts = new Map<string, number>();

  for (const e of buffer) {
    byLevel[e.level]++;
    bySource[e.source]++;
    counts.set(e.component, (counts.get(e.component) ?? 0) + 1);
  }

  const topComponents = [...counts.entries()]
    .map(([component, count]) => ({ component, count }))
    .sort((a, b) => b.count - a.count || a.component.localeCompare(b.component))
    .slice(0, 10);

  return {
    total: buffer.length,
    dropped,
    capacity: LIMITS.maxEntries,
    byLevel,
    bySource,
    topComponents,
    oldestAt: buffer.length ? buffer[0].at : null,
    newestAt: buffer.length ? buffer[buffer.length - 1].at : null,
  };
}
