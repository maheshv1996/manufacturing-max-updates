/**
 * GL backfill — bring pre-auto-post documents into the ledger.
 * ---------------------------------------------------------------------------
 * autoPostToGL only covers documents created after it shipped; older sales
 * invoices and supplier invoices never entered the books. This enumerates
 * those documents (by mirroring each flow's exact line recipe from the stored
 * row — sales invoice, customer payment, supplier invoice) and posts the
 * missing journal entries idempotently through the same autoPostToGL path.
 *
 * Document classes deliberately NOT covered here, because their splits are
 * runtime computations not fully reconstructable from a single stored row:
 * supplier/expense/payroll payments (treasury OUTFLOW rows — category-specific
 * line building), payroll accruals. The GL repair queue covers post-shipment
 * failures for those flows going forward.
 */
import { prisma } from "./prisma";
import { autoPostToGL, type AutoPostInput } from "./glPosting";

export type BackfillKind =
  | "sales_invoice"
  | "customer_payment"
  | "supplier_invoice";

export interface BackfillCandidate {
  kind: BackfillKind;
  source: AutoPostInput["source"];
  sourceId: string;
  docNumber: string;
  memo: string;
  date?: Date;
  lines: AutoPostInput["lines"];
}

/** Every (source, sourceId) already present in the ledger. */
async function existingLedgerKeys(): Promise<Set<string>> {
  const rows = await prisma.journalEntry.findMany({
    where: { source: { in: ["INVOICE", "PAYMENT", "VOUCHER"] } },
    select: { source: true, sourceId: true },
  });
  return new Set(
    rows
      .filter((r) => r.sourceId)
      .map((r) => `${r.source}:${r.sourceId}`),
  );
}

/** Sales invoices with no INVOICE journal entry (recipe mirrors /api/invoices). */
async function salesInvoiceCandidates(keys: Set<string>): Promise<BackfillCandidate[]> {
  const invoices = await prisma.invoice.findMany({
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      customerName: true,
      taxType: true,
      taxableValue: true,
      cgstAmt: true,
      sgstAmt: true,
      igstAmt: true,
      totalValue: true,
    },
  });
  const out: BackfillCandidate[] = [];
  for (const inv of invoices) {
    if (Number(inv.totalValue) <= 0.01) continue;
    if (keys.has(`INVOICE:${inv.id}`)) continue;
    const outTax =
      Number(inv.cgstAmt || 0) + Number(inv.sgstAmt || 0) + Number(inv.igstAmt || 0);
    out.push({
      kind: "sales_invoice",
      source: "INVOICE",
      sourceId: inv.id,
      docNumber: inv.invoiceNumber,
      memo: `Sales invoice ${inv.invoiceNumber} — ${inv.customerName || "customer"} (${Number(inv.totalValue).toFixed(2)})`,
      date: inv.invoiceDate ? new Date(inv.invoiceDate) : undefined,
      lines: [
        {
          accountCode: "1030",
          debit: Number(inv.totalValue),
          reference: inv.invoiceNumber,
          narration: `Receivable ${inv.invoiceNumber}`,
        },
        {
          accountCode: inv.taxType === "INTER" ? "4020" : "4010",
          credit: Number(inv.taxableValue),
          reference: inv.invoiceNumber,
          narration: `Sales — ${inv.customerName || "customer"}`,
        },
        ...(outTax > 0.01
          ? [
              {
                accountCode: "2020",
                credit: outTax,
                reference: inv.invoiceNumber,
                narration: "GST output collected",
              },
            ]
          : []),
      ],
    });
  }
  return out;
}

/** Customer payments with no PAYMENT journal entry (mirrors /api/invoices/[id]/pay). */
async function customerPaymentCandidates(keys: Set<string>): Promise<BackfillCandidate[]> {
  const payments = await prisma.payment.findMany({
    select: {
      id: true,
      amount: true,
      paymentDate: true,
      method: true,
      invoice: { select: { invoiceNumber: true } },
    },
  });
  const out: BackfillCandidate[] = [];
  for (const p of payments) {
    if (Number(p.amount) <= 0.01) continue;
    if (keys.has(`PAYMENT:${p.id}`)) continue;
    out.push({
      kind: "customer_payment",
      source: "PAYMENT",
      sourceId: p.id,
      docNumber: p.invoice.invoiceNumber,
      memo: `Customer payment ${Number(p.amount)} via ${p.method} — invoice ${p.invoice.invoiceNumber}`,
      date: p.paymentDate ? new Date(p.paymentDate) : undefined,
      lines: [
        {
          accountCode: "1020",
          debit: Number(p.amount),
          reference: p.invoice.invoiceNumber,
          narration: "Bank receipt",
        },
        {
          accountCode: "1030",
          credit: Number(p.amount),
          reference: p.invoice.invoiceNumber,
          narration: `Against ${p.invoice.invoiceNumber}`,
        },
      ],
    });
  }
  return out;
}

/** Supplier invoices with no VOUCHER journal entry (mirrors the GRN module). */
async function supplierInvoiceCandidates(keys: Set<string>): Promise<BackfillCandidate[]> {
  const invoices = await prisma.supplierInvoice.findMany({
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      amount: true, // net goods value
      taxAmount: true,
      totalAmount: true,
    },
  });
  const out: BackfillCandidate[] = [];
  for (const inv of invoices) {
    if (Number(inv.totalAmount) <= 0.01) continue;
    if (keys.has(`VOUCHER:${inv.id}`)) continue;
    const net = Number(inv.amount || 0);
    const tax = Number(inv.taxAmount || 0);
    out.push({
      kind: "supplier_invoice",
      source: "VOUCHER",
      sourceId: inv.id,
      docNumber: inv.invoiceNumber,
      memo: `Supplier invoice ${inv.invoiceNumber} — purchases ${net} + GST ${tax}`,
      date: inv.invoiceDate ? new Date(inv.invoiceDate) : undefined,
      lines: [
        {
          accountCode: "1050",
          debit: net,
          reference: inv.invoiceNumber,
          narration: "Goods purchases per supplier invoice",
        },
        ...(tax > 0.01
          ? [
              {
                accountCode: "1040",
                debit: tax,
                reference: inv.invoiceNumber,
                narration: "Input GST credit (ITC)",
              },
            ]
          : []),
        {
          accountCode: "2010",
          credit: Number(inv.totalAmount),
          reference: inv.invoiceNumber,
          narration: `Payable ${inv.invoiceNumber}`,
        },
      ],
    });
  }
  return out;
}

/** Enumerate every document the ledger is missing (preview + execute share this). */
export async function listGlBackfillCandidates(): Promise<BackfillCandidate[]> {
  const keys = await existingLedgerKeys();
  const [a, b, c] = await Promise.all([
    salesInvoiceCandidates(keys),
    customerPaymentCandidates(keys),
    supplierInvoiceCandidates(keys),
  ]);
  // Deterministic order: kind, then doc number.
  return [...a, ...b, ...c].sort((x, y) =>
    `${x.kind}:${x.docNumber}`.localeCompare(`${y.kind}:${y.docNumber}`),
  );
}

export interface BackfillResult {
  posted: number;
  skipped: number;
  failed: Array<{ kind: BackfillKind; docNumber: string; error: string }>;
}

/** Post all missing documents idempotently. Audit rows are written per doc. */
export async function runGlBackfill(actor: string): Promise<BackfillResult> {
  const candidates = await listGlBackfillCandidates();
  const result: BackfillResult = { posted: 0, skipped: 0, failed: [] };
  for (const c of candidates) {
    const r = await autoPostToGL({
      source: c.source,
      sourceId: c.sourceId,
      memo: c.memo,
      createdBy: actor,
      date: c.date,
      lines: c.lines,
    });
    if (r.ok && !r.skipped) {
      result.posted += 1;
      // autoPostToGL already audit-trails failures; add a backfill marker for
      // the ledger-keepers so they know this entry arrived via backfill.
      try {
        const { logAudit } = await import("./audit");
        await logAudit({
          actor,
          action: "GL_BACKFILL",
          entityType: "GL_JOURNAL",
          entityId: c.sourceId,
          details: `Backfilled ${c.kind} ${c.docNumber} → ${r.entryNumber}`,
        });
      } catch {
        /* audit must not break the backfill */
      }
    } else if (r.ok && r.skipped) {
      result.skipped += 1; // raced with a concurrent post — fine
    } else {
      result.failed.push({ kind: c.kind, docNumber: c.docNumber, error: r.error || "unknown" });
    }
  }
  return result;
}
