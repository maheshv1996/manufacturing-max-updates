/**
 * GL backfill — bring pre-auto-post documents into the ledger.
 * ---------------------------------------------------------------------------
 * autoPostToGL only covers documents created after it shipped; older documents
 * never entered the books. This enumerates those documents (by mirroring each
 * flow's exact line recipe from the stored rows) and posts the missing journal
 * entries idempotently through the same autoPostToGL path.
 *
 * Covered classes: sales invoice, customer payment, supplier invoice, and —
 * reconstructable from stored rows — supplier payments, expense
 * reimbursements, payroll settlements (treasury OUTFLOW rows + the document
 * they reference) and payroll accruals (payslip aggregates for the run month).
 * Treasury rows whose reference does not resolve to a document (e.g. legacy
 * cashbook entries) are skipped and reported, never guessed at.
 */
import { prisma } from "./prisma";
import { autoPostToGL, type AutoPostInput } from "./glPosting";
import { fromPaise, fromPaiseRow } from "./money";
import { CATEGORY_ACCOUNT } from "./expenseCategories";

export type BackfillKind =
  | "sales_invoice"
  | "customer_payment"
  | "supplier_invoice"
  | "supplier_payment"
  | "expense_payment"
  | "payroll_payment"
  | "payroll_accrual";

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
  for (const invRaw of invoices) {
    const inv = fromPaiseRow("Invoice", invRaw); // stored paise → rupee lines
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
  for (const pRaw of payments) {
    const p = fromPaiseRow("Payment", pRaw); // stored paise → rupee lines
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
  for (const invRaw of invoices) {
    const inv = fromPaiseRow("SupplierInvoice", invRaw); // stored paise → rupee lines
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

/** Supplier payments — treasury OUTFLOW rows (mirrors the GRN pay block). */
async function supplierPaymentCandidates(keys: Set<string>): Promise<BackfillCandidate[]> {
  const txs = await prisma.treasuryTransaction.findMany({
    where: { type: "OUTFLOW", category: "Supplier Payment" },
    orderBy: { date: "asc" },
  });
  // Resolve each row's reference to its supplier invoice (invoiceNumber).
  const numbers = txs.map((t) => t.reference || "").filter(Boolean);
  const invoices = numbers.length
    ? await prisma.supplierInvoice.findMany({
        where: { invoiceNumber: { in: numbers } },
        select: { id: true, invoiceNumber: true, totalAmount: true },
      })
    : [];
  const byNumber = new Map(invoices.map((i) => [i.invoiceNumber, i]));
  const out: BackfillCandidate[] = [];
  for (const tRaw of txs) {
    if (keys.has(`PAYMENT:${tRaw.id}`)) continue;
    const inv = tRaw.reference ? byNumber.get(tRaw.reference) : undefined;
    if (!inv) continue; // legacy cashbook rows (no resolvable document) — never guessed
    const amount = fromPaise(Number(tRaw.amount));
    if (amount <= 0.01) continue;
    out.push({
      kind: "supplier_payment",
      source: "PAYMENT",
      sourceId: tRaw.id,
      docNumber: inv.invoiceNumber,
      memo: `Supplier payment ${inv.invoiceNumber} — settles payable (backfill)`,
      date: tRaw.date ? new Date(tRaw.date) : undefined,
      lines: [
        {
          accountCode: "2010",
          debit: amount,
          reference: inv.invoiceNumber,
          narration: `Settled ${inv.invoiceNumber}`,
        },
        {
          accountCode: "1020",
          credit: amount,
          reference: inv.invoiceNumber,
          narration: "Bank — Main",
        },
      ],
    });
  }
  return out;
}

/** Expense reimbursements — treasury OUTFLOW rows (mirrors the expenses pay block). */
async function expensePaymentCandidates(keys: Set<string>): Promise<BackfillCandidate[]> {
  const txs = await prisma.treasuryTransaction.findMany({
    where: { type: "OUTFLOW", category: "Expense Reimbursement" },
    orderBy: { date: "asc" },
  });
  const numbers = txs.map((t) => t.reference || "").filter(Boolean);
  const claims = numbers.length
    ? await prisma.expenseClaim.findMany({
        where: { claimNumber: { in: numbers } },
        include: { items: true },
      })
    : [];
  const byNumber = new Map(claims.map((c) => [c.claimNumber, c]));
  const out: BackfillCandidate[] = [];
  for (const tRaw of txs) {
    if (keys.has(`PAYMENT:${tRaw.id}`)) continue;
    const claim = tRaw.reference ? byNumber.get(tRaw.reference) : undefined;
    if (!claim || !Array.isArray(claim.items)) continue;
    const total = fromPaise(Number(claim.totalAmount || 0));
    if (total <= 0.01) continue;
    const byAccount = new Map<string, number>();
    for (const it of claim.items) {
      const acc = CATEGORY_ACCOUNT[String(it.category).toUpperCase()] || "5140";
      byAccount.set(acc, (byAccount.get(acc) || 0) + fromPaise(Number(it.amount || 0)));
    }
    const lines: AutoPostInput["lines"] = [];
    for (const [acc, amt] of byAccount) {
      if (amt > 0.01)
        lines.push({ accountCode: acc, debit: amt, reference: claim.claimNumber, narration: `Expense ${claim.claimNumber} — ${claim.claimantName || "employee"}` });
    }
    lines.push({ accountCode: "1020", credit: total, reference: claim.claimNumber, narration: `Reimbursement ${claim.claimNumber} via Bank` });
    out.push({
      kind: "expense_payment",
      source: "PAYMENT",
      sourceId: tRaw.id,
      docNumber: claim.claimNumber,
      memo: `Expense reimbursement ${claim.claimNumber} — ${claim.claimantName || "employee"} (backfill)`,
      date: tRaw.date ? new Date(tRaw.date) : undefined,
      lines,
    });
  }
  return out;
}

/** Payslip sums for a month, in rupee terms (payslip amounts stay rupee floats). */
async function payrollSums(month: string) {
  const sums = await prisma.payslip.aggregate({
    where: { month },
    _sum: {
      grossPay: true,
      pfDeduction: true,
      ptDeduction: true,
      esiDeduction: true,
      netPay: true,
      bonus: true,
      arrears: true,
      lopDeduction: true,
    },
  });
  const s: any = sums._sum || {};
  const statu =
    Math.round(((s.pfDeduction || 0) + (s.esiDeduction || 0) + (s.ptDeduction || 0)) * 100) / 100;
  const netSum = Math.round((s.netPay || 0) * 100) / 100;
  const expense =
    Math.round(
      ((s.grossPay || 0) + (s.bonus || 0) + (s.arrears || 0) - (s.lopDeduction || 0)) * 100,
    ) / 100;
  return { statu, netSum, expense };
}

/** Payroll settlements — treasury OUTFLOW rows (mirrors the settle-run block). */
async function payrollPaymentCandidates(keys: Set<string>): Promise<BackfillCandidate[]> {
  const txs = await prisma.treasuryTransaction.findMany({
    where: { type: "OUTFLOW", category: "Payroll Settlement" },
    orderBy: { date: "asc" },
  });
  const out: BackfillCandidate[] = [];
  for (const tRaw of txs) {
    if (keys.has(`PAYMENT:${tRaw.id}`)) continue;
    const m = /^Payroll-(\d{4}-\d{2})$/.exec(tRaw.reference || "");
    if (!m) continue;
    const { statu, netSum } = await payrollSums(m[1]);
    if (netSum <= 0.01) continue;
    const total = Math.round((netSum + statu) * 100) / 100;
    out.push({
      kind: "payroll_payment",
      source: "PAYMENT",
      sourceId: tRaw.id,
      docNumber: `Payroll-${m[1]}`,
      memo: `Payroll settlement ${m[1]} — net ${netSum} + statutory ${statu} (backfill)`,
      date: tRaw.date ? new Date(tRaw.date) : undefined,
      lines: [
        { accountCode: "2050", debit: netSum, narration: "Net wages paid" },
        ...(statu > 0.01
          ? [{ accountCode: "2030", debit: statu, narration: "PF / ESI / PT remitted" }]
          : []),
        { accountCode: "1020", credit: total, narration: "Bank — payroll" },
      ],
    });
  }
  return out;
}

/** Payroll accruals — approved runs with payslips, no accrual voucher (mirrors approve-run). */
async function payrollAccrualCandidates(keys: Set<string>): Promise<BackfillCandidate[]> {
  const runs = await prisma.payrollRun.findMany({
    where: { approvedAt: { not: null } },
    orderBy: { month: "asc" },
  });
  const out: BackfillCandidate[] = [];
  for (const run of runs) {
    if (keys.has(`VOUCHER:${run.id}`)) continue;
    const { statu, netSum, expense } = await payrollSums(run.month);
    if (netSum <= 0.01) continue;
    const lines: AutoPostInput["lines"] = [
      { accountCode: "5080", debit: expense, narration: `Payroll ${run.month} — net ${netSum} + statutory ${statu}` },
    ];
    if (statu > 0.01)
      lines.push({ accountCode: "2030", credit: statu, narration: "PF / ESI / PT statutory dues" });
    lines.push({ accountCode: "2050", credit: netSum, narration: "Net wages payable (bank transfer)" });
    out.push({
      kind: "payroll_accrual",
      source: "VOUCHER",
      sourceId: run.id,
      docNumber: `Payroll-${run.month}`,
      memo: `Payroll run ${run.month} approved — salaries & wages accrual (backfill)`,
      date: run.approvedAt || undefined,
      lines,
    });
  }
  return out;
}

/** Enumerate every document the ledger is missing (preview + execute share this). */
export async function listGlBackfillCandidates(): Promise<BackfillCandidate[]> {
  const keys = await existingLedgerKeys();
  const [a, b, c, d, e, f, g] = await Promise.all([
    salesInvoiceCandidates(keys),
    customerPaymentCandidates(keys),
    supplierInvoiceCandidates(keys),
    supplierPaymentCandidates(keys),
    expensePaymentCandidates(keys),
    payrollPaymentCandidates(keys),
    payrollAccrualCandidates(keys),
  ]);
  // Deterministic order: kind, then doc number.
  return [...a, ...b, ...c, ...d, ...e, ...f, ...g].sort((x, y) =>
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
