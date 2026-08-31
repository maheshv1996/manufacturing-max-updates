import { prisma } from "./prisma";

/** Next sequential voucher number for a year: VCH-<year>-NNNN. */
export async function nextVoucherNumber(date: Date = new Date()): Promise<string> {
  const safeDate = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const year = safeDate.getFullYear();
  const prefix = `VCH-${year}-`;

  const last = await prisma.voucher.findFirst({
    where: { voucherNumber: { startsWith: prefix } },
    orderBy: { voucherNumber: "desc" },
    select: { voucherNumber: true },
  });

  let seq = 1;
  if (last && last.voucherNumber) {
    const match = last.voucherNumber.match(/(\d+)$/);
    const n = match ? parseInt(match[1], 10) : NaN;
    if (!isNaN(n) && n >= 1) {
      seq = n + 1;
    }
  }

  let num = `${prefix}${String(seq).padStart(4, "0")}`;
  let loopCount = 0;

  // Collision-safe loop with bounded ceiling
  while (loopCount < 100) {
    loopCount++;
    const existing = await prisma.voucher.findUnique({
      where: { voucherNumber: num },
      select: { id: true },
    });
    if (!existing) break;
    seq += 1;
    num = `${prefix}${String(seq).padStart(4, "0")}`;
  }

  return num;
}
