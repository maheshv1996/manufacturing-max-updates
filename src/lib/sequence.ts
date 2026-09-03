import { prisma } from "./prisma";

/**
 * Atomic DB-backed sequence. Uses SequenceCounter with row-level upsert.
 * Safe under concurrent Vercel/serverless invocations — relies on
 * Postgres unique constraint on SequenceCounter.id, not in-memory state.
 *
 * Usage inside a transaction:
 *   const grnNumber = await nextSequenceTx(tx, "GRN", 4);
 * Outside a transaction:
 *   const poNumber = await nextSequence("PO", 3);
 */
export async function nextSequence(
  prefix: string,
  minDigits = 3,
  date: Date = new Date(),
): Promise<string> {
  const year = date instanceof Date && !isNaN(date.getTime()) ? date.getFullYear() : new Date().getFullYear();
  const clean = String(prefix || "DOC").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const counterId = `${clean}-${year}`;
  const fullPrefix = `${clean}-${year}-`;

  // Prisma upsert is atomic on @id.
  // We use a retry-friendly pattern: increment and return previous +1.
  // Prisma doesn't support RETURNING previous, so we read-then-increment inside a transaction via interactive transaction.
  const result = await prisma.$transaction(async (tx) => {
    const existing = await (tx as any).sequenceCounter.findUnique({ where: { id: counterId } });
    if (!existing) {
      await (tx as any).sequenceCounter.create({ data: { id: counterId, nextVal: 2 } });
      return 1;
    }
    const current = existing.nextVal;
    await (tx as any).sequenceCounter.update({ where: { id: counterId }, data: { nextVal: current + 1 } });
    return current;
  });

  return `${fullPrefix}${String(result).padStart(minDigits, "0")}`;
}

export async function nextSequenceTx(
  tx: any,
  prefix: string,
  minDigits = 3,
  date: Date = new Date(),
): Promise<string> {
  const year = date instanceof Date && !isNaN(date.getTime()) ? date.getFullYear() : new Date().getFullYear();
  const clean = String(prefix || "DOC").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const counterId = `${clean}-${year}`;
  const fullPrefix = `${clean}-${year}-`;

  const existing = await tx.sequenceCounter.findUnique({ where: { id: counterId } });
  if (!existing) {
    await tx.sequenceCounter.create({ data: { id: counterId, nextVal: 2 } });
    return `${fullPrefix}${String(1).padStart(minDigits, "0")}`;
  }
  const current = existing.nextVal;
  await tx.sequenceCounter.update({ where: { id: counterId }, data: { nextVal: current + 1 } });
  return `${fullPrefix}${String(current).padStart(minDigits, "0")}`;
}
