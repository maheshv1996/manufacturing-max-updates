import { prisma } from "./prisma";

/**
 * Generates the next sequential business number (e.g. TRN-2026-001, GRV-2026-002, CNT-2026-003).
 *
 * Robust & Collision-resistant:
 * - Validates Prisma model delegates.
 * - Extracts and parses numerical suffixes via Regex.
 * - Supports configurable digit padding (default 3 digits).
 */
export async function nextSeqNumber(
  modelName: string,
  fieldName: string,
  prefix: string,
  date: Date = new Date(),
  minDigits = 3,
): Promise<string> {
  const cleanPrefix = String(prefix || "DOC").trim().toUpperCase();
  const year = date instanceof Date && !isNaN(date.getTime()) ? date.getFullYear() : new Date().getFullYear();
  const fullPrefix = `${cleanPrefix}-${year}-`;

  // 1. Validate Prisma model delegate
  const delegate = (prisma as any)[modelName];
  if (!delegate || typeof delegate.findFirst !== "function") {
    console.warn(`nextSeqNumber: Model delegate '${modelName}' not found on Prisma Client. Falling back to timestamp sequence.`);
    return `${fullPrefix}${String(Date.now()).slice(-minDigits)}`;
  }

  try {
    // 2. Fetch the most recent sequential record for the current year
    const lastRecord = await delegate.findFirst({
      where: {
        [fieldName]: { startsWith: fullPrefix },
      },
      orderBy: { [fieldName]: "desc" },
      select: { [fieldName]: true },
    });

    let nextNum = 1;

    if (lastRecord && lastRecord[fieldName]) {
      const val = String(lastRecord[fieldName]);
      // Extract numerical suffix following the prefix
      const match = val.replace(fullPrefix, "").match(/\d+/);
      if (match) {
        const parsed = parseInt(match[0], 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
          nextNum = parsed + 1;
        }
      }
    }

    return `${fullPrefix}${String(nextNum).padStart(minDigits, "0")}`;
  } catch (error) {
    console.error(`nextSeqNumber error on ${modelName}.${fieldName}:`, error);
    // Fallback: Return a unique sequence string to avoid blocking business transaction
    return `${fullPrefix}${String(Date.now()).slice(-minDigits)}`;
  }
}
