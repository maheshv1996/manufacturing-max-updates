import { prisma } from "./prisma";

/** Next sequential voucher number for a year: VCH-<year>-NNNN. */
export async function nextVoucherNumber(date: Date): Promise<string> {
  const prefix = `VCH-${date.getFullYear()}-`;
  const last = await prisma.voucher.findFirst({
    where: { voucherNumber: { startsWith: prefix } },
    orderBy: { voucherNumber: "desc" },
    select: { voucherNumber: true },
  });
  let seq = 1;
  if (last) {
    const tail = last.voucherNumber.replace(prefix, "");
    const n = parseInt(tail, 10);
    if (!isNaN(n)) seq = n + 1;
  }
  let num = `${prefix}${String(seq).padStart(4, "0")}`;
  for (;;) {
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
