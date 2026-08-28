import { prisma } from "./prisma";

// Sequential business numbers shared across the HR wave: TRN-YYYY-NNN, GRV-YYYY-NNN,
// DISC-YYYY-NNN, CNT-YYYY-NNN. Collision-safe: parses the max existing suffix for the
// year and increments, so a parallel create retried by the caller still advances.
export async function nextSeqNumber(
  model: string,
  field: string,
  prefix: string,
  date: Date = new Date(),
): Promise<string> {
  const full = `${prefix}-${date.getFullYear()}-`;
  const last: any = await (prisma as any)[model].findFirst({
    where: { [field]: { startsWith: full } },
    orderBy: { [field]: "desc" },
  });
  const seq = last
    ? parseInt(String(last[field]).replace(full, ""), 10) + 1
    : 1;
  return `${full}${String(seq).padStart(3, "0")}`;
}
