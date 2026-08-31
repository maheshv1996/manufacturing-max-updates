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

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * GST compliant tax calculator for Intra-State (CGST + SGST) and Inter-State (IGST) invoices.
 * Supports standard Indian GST slabs (0%, 5%, 12%, 18%, 28%).
 */
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
    cgstAmt = round2((safeTaxable * safeRate) / 200);
    sgstAmt = round2((safeTaxable * safeRate) / 200);
    igstAmt = 0;
  } else {
    cgstAmt = 0;
    sgstAmt = 0;
    igstAmt = round2((safeTaxable * safeRate) / 100);
  }

  const totalValue = round2(safeTaxable + cgstAmt + sgstAmt + igstAmt);

  return {
    taxableValue: round2(safeTaxable),
    taxType,
    taxRatePct: safeRate,
    cgstAmt,
    sgstAmt,
    igstAmt,
    totalValue,
  };
}

/**
 * Generates the next sequential invoice number for the active fiscal year.
 * Format: INV-YYYY-NNN (e.g. INV-2026-001)
 */
export async function generateInvoiceNumber(customPrefix?: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = customPrefix || `INV-${year}-`;

  const latestInvoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  if (!latestInvoice || !latestInvoice.invoiceNumber) {
    return `${prefix}001`;
  }

  const match = latestInvoice.invoiceNumber.match(/(\d+)$/);
  const lastSeq = match ? parseInt(match[1], 10) : 0;
  const nextSeq = isNaN(lastSeq) || lastSeq < 0 ? 1 : lastSeq + 1;

  return `${prefix}${nextSeq.toString().padStart(3, "0")}`;
}

/**
 * Indian Numbering Format Currency to Words Converter.
 * Converts numerical amounts to Indian English words (Crores, Lakhs, Thousands, Hundreds, Rupees, and Paise).
 */
export function numberToIndianWords(
  num: number,
  currencyName = "Rupees",
  minorCurrencyName = "Paise",
): string {
  if (isNaN(num) || num === 0) {
    return `${currencyName} Zero Only`;
  }

  const isNegative = num < 0;
  const absNum = Math.abs(num);

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
    if (n < 100) {
      return (
        tens[Math.floor(n / 10)] +
        " " +
        (n % 10 !== 0 ? units[n % 10] + " " : "")
      );
    }
    return (
      units[Math.floor(n / 100)] +
      " Hundred " +
      (n % 100 !== 0 ? convertChunk(n % 100) : "")
    );
  }

  const integerPart = Math.floor(absNum);
  const roundedCents = Math.round(absNum * 100);
  const paisePart = roundedCents % 100;

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
  let result = words ? `${currencyName} ${words}` : `${currencyName} Zero`;

  if (paisePart > 0) {
    result += ` And ${convertChunk(paisePart).trim()} ${minorCurrencyName}`;
  }

  const prefix = isNegative ? "Minus " : "";
  return `${prefix}${result} Only`;
}
