/**
 * Employee-number / identifier resolution — badge culture, not email culture.
 *
 * Resolution order (per product spec):
 *   1. employeeNumber (exact match, e.g. "1042")
 *   2. username / email (legacy accounts keep working)
 *
 * This is the single resolver used by the login route, and the ready-hook for
 * a future QR badge scan: a scanner can feed the scanned badge value through
 * `findUserByIdentifier` and get the same user the keypad login would.
 *
 * NOTE: this helper MUST be used inside a route/request context where the
 * caller supplies `prisma` (it is not safe to import prisma at module scope
 * in Edge bundles; routes pass their Node prisma client in).
 */
import type { PrismaClient } from "@prisma/client";

export const IDENTIFIER_FIELDS = [
  "employeeNumber",
  "username",
  "email",
] as const;

export async function findUserByIdentifier(
  prisma: PrismaClient,
  identifier: string,
  opts: { includeRole?: boolean; activeOnly?: boolean } = {},
) {
  const raw = String(identifier || "").trim();
  if (!raw) return null;

  const base = opts.activeOnly === false ? {} : { isActive: true };
  const include = opts.includeRole ? { role: true } : undefined;

  // 1. employeeNumber first — badge culture.
  const byEmp = await prisma.user.findFirst({
    where: { ...base, employeeNumber: raw },
    include,
  });
  if (byEmp) return byEmp;

  // 2. Fall back to username / email for legacy accounts.
  return prisma.user.findFirst({
    where: {
      ...base,
      OR: [{ username: raw }, { email: raw }],
    },
    include,
  });
}
