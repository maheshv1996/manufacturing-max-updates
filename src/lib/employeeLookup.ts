/**
 * Employee-number / identifier resolution — badge culture, not email culture.
 *
 * Resolution strategy:
 *   1. Hardware scanner artifact stripping (e.g. leading "#", "ID:", whitespace)
 *   2. Direct case-normalized resolution across uppercase, lowercase, and exact inputs
 *   3. High-performance indexed lookup across employeeNumber, username, and email
 *   4. Phone number digit normalization fallback (for mobile kiosk & SMS terminals)
 *
 * This is the single resolver used by login routes, kiosk terminals, and barcode/QR scanners.
 */
import type { PrismaClient } from "@prisma/client";

export const IDENTIFIER_FIELDS = [
  "employeeNumber",
  "username",
  "email",
] as const;

export type IdentifierField = (typeof IDENTIFIER_FIELDS)[number];

export interface EmployeeLookupOptions {
  includeRole?: boolean;
  includeDepartment?: boolean;
  activeOnly?: boolean;
  include?: any;
}

/**
 * Resolves a User record from any shopfloor credential string.
 */
export async function findUserByIdentifier(
  prisma: PrismaClient | any,
  identifier: string | null | undefined,
  opts: EmployeeLookupOptions = {},
) {
  let raw = String(identifier || "").trim();
  if (!raw) return null;

  // Clean barcode/QR scanner artifacts (e.g. leading '#' or 'EMP:' or 'ID-')
  if (raw.startsWith("#")) {
    raw = raw.slice(1).trim();
  } else if (/^(emp|id|user):/i.test(raw)) {
    raw = raw.replace(/^(emp|id|user):/i, "").trim();
  }

  const base = opts.activeOnly === false ? {} : { isActive: true };
  const include = opts.include || {
    ...(opts.includeRole ? { role: true } : {}),
  };

  // Generate casing candidates for indexed lookups (handles both UPPER and lower case badges)
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();
  const candidates = Array.from(new Set([raw, upper, lower])).filter(Boolean);

  // Phone number digits extraction (e.g. "+91 98200 00001" -> "9820000001")
  const digitsOnly = raw.replace(/[^0-9]/g, "");
  const isPhoneCandidate = digitsOnly.length >= 10 && digitsOnly.length <= 15;

  const orConditions: any[] = [
    { employeeNumber: { in: candidates } },
    { username: { in: candidates } },
    { email: lower },
  ];

  if (isPhoneCandidate) {
    orConditions.push({ employeeNumber: digitsOnly });
    orConditions.push({ username: digitsOnly });
  }

  // Fast single-roundtrip query hitting database unique indexes
  const user = await prisma.user.findFirst({
    where: {
      ...base,
      OR: orConditions,
    },
    include: Object.keys(include).length > 0 ? include : undefined,
  });

  return user;
}
