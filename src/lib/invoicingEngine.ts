import { prisma } from "@/lib/prisma";

export interface TaxCalculationResult {
  taxableValue: number;
  taxType: "INTRA" | "INTER";
  taxRatePct: number;
  cgstAmt: number;
  sgstAmt: number;
  igstAmt: number;
  totalValue: number;
}

export function calculateTax(
  taxableValue: number,
  taxType: "INTRA" | "INTER" = "INTRA",
  taxRatePct: number = 18,
): TaxCalculationResult {
  const safeTaxable = Math.max(0, Number(taxableValue) || 0);
  const safeRate = Math.max(0, Number(taxRatePct) || 0);

  let cgstAmt = 0;
  let sgstAmt = 0;
  let igstAmt = 0;

  if (taxType === "INTRA") {
    cgstAmt = Number(((safeTaxable * safeRate) / 200).toFixed(2));
    sgstAmt = Number(((safeTaxable * safeRate) / 200).toFixed(2));
    igstAmt = 0;
  } else {
    cgstAmt = 0;
    sgstAmt = 0;
    igstAmt = Number(((safeTaxable * safeRate) / 100).toFixed(2));
  }

  const totalValue = Number(
    (safeTaxable + cgstAmt + sgstAmt + igstAmt).toFixed(2),
  );

  return {
    taxableValue: Number(safeTaxable.toFixed(2)),
    taxType,
    taxRatePct: safeRate,
    cgstAmt,
    sgstAmt,
    igstAmt,
    totalValue,
  };
}

export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const latestInvoice = await (prisma as any).invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
  });

  if (!latestInvoice) {
    return `${prefix}001`;
  }

  const parts = latestInvoice.invoiceNumber.split("-");
  const lastSeq = parseInt(parts[parts.length - 1], 10);
  const nextSeq = isNaN(lastSeq) ? 1 : lastSeq + 1;
  return `${prefix}${nextSeq.toString().padStart(3, "0")}`;
}

/**
 * Indian Numbering Format Converter (Crores, Lakhs, Thousands, Hundreds)
 */
export function numberToIndianWords(num: number): string {
  if (isNaN(num) || num === 0) return "Rupees Zero Only";

  const units = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertChunk(n: number): string {
    if (n === 0) return "";
    if (n < 20) return units[n] + " ";
    if (n < 100)
      return (
        tens[Math.floor(n / 10)] +
        " " +
        (n % 10 !== 0 ? units[n % 10] + " " : "")
      );
    return (
      units[Math.floor(n / 100)] +
      " Hundred " +
      (n % 100 !== 0 ? convertChunk(n % 100) : "")
    );
  }

  const integerPart = Math.floor(Math.abs(num));
  const paisePart = Math.round((Math.abs(num) - integerPart) * 100);

  let words = "";

  const crore = Math.floor(integerPart / 10000000);
  let remainder = integerPart % 10000000;

  const lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;

  const thousand = Math.floor(remainder / 1000);
  remainder = remainder % 1000;

  const hundred = remainder;

  if (crore > 0) words += convertChunk(crore) + "Crore ";
  if (lakh > 0) words += convertChunk(lakh) + "Lakh ";
  if (thousand > 0) words += convertChunk(thousand) + "Thousand ";
  if (hundred > 0) words += convertChunk(hundred);

  words = words.trim();
  let result = words ? `Rupees ${words}` : "Rupees Zero";

  if (paisePart > 0) {
    result += ` And ${convertChunk(paisePart).trim()} Paise`;
  }

  return `${result} Only`;
}
