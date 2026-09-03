import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { headers } from "next/headers";
import { checkIdempotency, reserveIdempotency, completeIdempotency } from "@/lib/idempotency";
import { nextSequenceTx } from "@/lib/sequence";

export const dynamic = "force-dynamic";

import { poOrderedValue, poFullyReceived } from "@/lib/poLines";
import { autoPostToGL } from "@/lib/glPosting";

const MATCH_TOLERANCE_PCT = 0.5; // 0.5% value tolerance

// Invoice shape that may carry line items (SupplierInvoiceLine rows mirroring
// the billed materials at PO-line level).
type InvoiceForMatch = {
  amount: number;
  taxAmount?: number;
  totalAmount?: number;
  lines?: Array<{
    lineNo?: number;
    poLineId?: string | null;
    qty?: number;
    unitCost?: number;
    amount?: number;
  }>;
} | null;

// Per-line invoice checks: a billed line that references a PO line may not
// bill more than was actually received for that line, nor drift from the
// agreed unit cost. Freeform lines (no poLineId) are covered by the
// invoice-level value check instead.
function invoiceLineIssues(
  po: { qty: number; unitCost: number; receivedQty?: number; lines?: any[] },
  invoice: InvoiceForMatch,
): string[] {
  if (!invoice || !Array.isArray(invoice.lines) || invoice.lines.length === 0) {
    return [];
  }
  const poLines = po.lines || [];
  const tolerance = MATCH_TOLERANCE_PCT / 100;
  const issues: string[] = [];
  for (const l of invoice.lines) {
    if (!l.poLineId) continue;
    const pol = poLines.find((x: any) => x.id === l.poLineId);
    const where = `Line ${l.lineNo ?? "?"}${pol && pol.lineNo != null ? ` (PO line ${pol.lineNo})` : ""}`;
    if (!pol) {
      issues.push(`${where}: billed against a PO line that does not belong to this PO`);
      continue;
    }
    const received = Number(pol.receivedQty || 0);
    const billed = Number(l.qty ?? 0);
    if (billed > received + Math.max(0.001, received * tolerance)) {
      issues.push(`${where}: bills ${billed} but only ${received} received on this PO line`);
    }
    const agreed = Number(pol.unitCost || 0);
    const cost = Number(l.unitCost ?? 0);
    if (agreed > 0 && Math.abs(cost - agreed) > Math.max(0.001, agreed * tolerance)) {
      issues.push(`${where}: unit cost ${cost} differs from agreed ${agreed}`);
    }
  }
  return issues;
}

// Compute the 3-way match status for a GRN against its PO and supplier invoice.
// Multi-line aware on both documents: the expected value comes from the PO's
// line items, the billed value from the invoice's line items, and a receipt is
// partial until every PO line is fully received.
function computeMatch(
  _grn: { receivedQty: number },
  po: { qty: number; unitCost: number; receivedQty?: number; lines?: any[] },
  invoice?: InvoiceForMatch,
) {
  if (!invoice) return "UNMATCHED";
  const expectedValue = poOrderedValue(po);
  let billedValue = Number(invoice.amount || 0);
  if (Array.isArray(invoice.lines) && invoice.lines.length > 0) {
    billedValue = 0;
    for (const l of invoice.lines) {
      billedValue += Number(l.amount ?? Number(l.qty ?? 0) * Number(l.unitCost ?? 0));
    }
  }
  // Short receipt (partial) still flagged unless every line is fully received
  const partial = !poFullyReceived(po);
  const valueTolerance = Math.max(1, expectedValue * (MATCH_TOLERANCE_PCT / 100));
  const valueOk = Math.abs(billedValue - expectedValue) <= valueTolerance;
  // Value disagreement is the harder control failure — flag it first
  if (!valueOk) return "MISMATCHED";
  const issues = invoiceLineIssues(po, invoice);
  if (issues.length > 0) return "MISMATCHED";
  if (partial) return "PARTIAL";
  return "MATCHED";
}

export async function GET() {
  try {
    const [grns, invoices, pos, suppliers, rawMaterials, aqlPlans] =
      await Promise.all([
        prisma.goodsReceiptNote.findMany({
          include: {
            po: { include: { lines: true } },
            supplier: { select: { id: true, name: true, code: true } },
            rawMaterial: {
              select: {
                id: true,
                sku: true,
                name: true,
                unit: true,
                materialClass: true,
              },
            },
            supplierInvoice: true,
          },
          orderBy: { receivedAt: "desc" },
        }),
        prisma.supplierInvoice.findMany({
          include: {
            supplier: { select: { name: true } },
            po: {
              select: {
                poNumber: true,
                qty: true,
                unitCost: true,
                receivedQty: true,
                lines: {
                  select: {
                    id: true,
                    lineNo: true,
                    qty: true,
                    unitCost: true,
                    receivedQty: true,
                  },
                },
              },
            },
            grn: { select: { grnNumber: true, receivedQty: true } },
            lines: {
              include: {
                rawMaterial: {
                  select: { id: true, sku: true, name: true, unit: true },
                },
                poLine: { select: { lineNo: true } },
              },
              orderBy: { lineNo: "asc" },
            },
          },
          orderBy: { invoiceDate: "desc" },
        }),
        prisma.purchaseOrder.findMany({
          where: { status: { not: "CANCELLED" } },
          include: {
            supplier: { select: { id: true, name: true } },
            rawMaterial: {
              select: { id: true, sku: true, name: true, unit: true },
            },
            lines: {
              include: {
                rawMaterial: { select: { id: true, sku: true, name: true, unit: true } },
              },
              orderBy: { lineNo: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.supplier.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.rawMaterial.findMany({
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            materialClass: true,
          },
          orderBy: { sku: "asc" },
        }),
        prisma.aqlPlan.findMany({ orderBy: { materialClass: "asc" } }),
      ]);

    // Posted-ledger reference for each supplier invoice (accrual voucher)
    const invIds = invoices.map((i) => i.id);
    const glVouchers = invIds.length
      ? await prisma.journalEntry.findMany({
          where: { source: "VOUCHER", sourceId: { in: invIds } },
          select: { sourceId: true, entryNumber: true },
        })
      : [];
    const glByInvId = new Map(glVouchers.map((g) => [g.sourceId, g.entryNumber]));

    const enriched = grns.map((g) => ({
      ...g,
      matchStatus: computeMatch(g, g.po, g.supplierInvoice || null),
    }));

    // Live invoice status vs match
    const now = Date.now();
    const enrichedInvoices = invoices.map((inv) => {
      const matchStatus = inv.grn
        ? computeMatch(inv.grn, inv.po || { qty: 0, unitCost: 0 }, inv)
        : "UNMATCHED";
      // Aging: days since invoice date (for unpaid/mismatched) and days overdue (past dueDate)
      const daysSinceInvoice = Math.max(
        0,
        Math.floor((now - new Date(inv.invoiceDate).getTime()) / 86400000),
      );
      const daysOverdue = inv.dueDate
        ? Math.max(
            0,
            Math.floor((now - new Date(inv.dueDate).getTime()) / 86400000),
          )
        : 0;
      let bucket = "current";
      if (inv.status === "PAID") bucket = "paid";
      else if (daysOverdue > 0) bucket = "overdue";
      else if (daysSinceInvoice > 60) bucket = "60plus";
      else if (daysSinceInvoice > 30) bucket = "30to60";
      else if (daysSinceInvoice > 0) bucket = "1to30";
      return {
        ...inv,
        matchStatus,
        glRef: glByInvId.get(inv.id) || null,
        aging: { daysSinceInvoice, daysOverdue, bucket },
      };
    });

    // Cash-flow forecast: outstanding matched/unpaid amounts bucketed by 30-day windows from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets30: { label: string; amount: number }[] = [
      { label: "0–30 days", amount: 0 },
      { label: "31–60 days", amount: 0 },
      { label: "61–90 days", amount: 0 },
      { label: "90+ days", amount: 0 },
      { label: "Overdue", amount: 0 },
    ];
    let outstandingTotal = 0;
    let overdueTotal = 0;
    for (const inv of enrichedInvoices) {
      if (inv.status === "PAID") continue;
      const total = inv.totalAmount || inv.amount || 0;
      outstandingTotal += total;
      const days = inv.aging.daysOverdue;
      if (days > 0) {
        overdueTotal += total;
        buckets30[4].amount += total;
        continue;
      }
      const dueIn = inv.dueDate
        ? Math.max(
            0,
            Math.ceil(
              (new Date(inv.dueDate).getTime() - today.getTime()) / 86400000,
            ),
          )
        : inv.aging.daysSinceInvoice;
      if (dueIn <= 30) buckets30[0].amount += total;
      else if (dueIn <= 60) buckets30[1].amount += total;
      else if (dueIn <= 90) buckets30[2].amount += total;
      else buckets30[3].amount += total;
    }

    return NextResponse.json({
      grns: enriched,
      invoices: enrichedInvoices,
      pos,
      suppliers,
      rawMaterials,
      aqlPlans: aqlPlans || [],
      cashflow: { buckets30, outstandingTotal, overdueTotal },
    });
  } catch (error: any) {
    console.error("GET /api/grn error:", error);
    return NextResponse.json(
      { error: "Failed to fetch GRN data" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const headerList = await headers();
    const userName = headerList.get("x-user-name") || "System";
    const headerClientId = headerList.get("x-client-id");
    const bodyClientId = (body as any)?.clientId || (body as any)?.data?.clientId;
    const clientId: string | null = (bodyClientId ? String(bodyClientId).trim() : null) || (headerClientId ? String(headerClientId).trim() : null);
    if (clientId) {
      const dup = await checkIdempotency(clientId);
      if (dup.duplicate) {
        const cached: any = (dup.existing as any)?.response;
        if (cached) return NextResponse.json(cached);
        return NextResponse.json({ success: true, duplicate: true, message: "Duplicate request ignored (idempotent)" });
      }
    }

    // ---- Goods Receipt Note: receives stock, updates PO + inventory (ATOMIC) ----
    if (body.entity === "grn") {
      const { poId, receivedQty, batchNo, notes, poLineId } = body.data || {};
      if (!poId || receivedQty == null)
        return NextResponse.json(
          { error: "poId and receivedQty required" },
          { status: 400 },
        );
      const qty = Number(receivedQty);
      if (!Number.isFinite(qty) || qty <= 0)
        return NextResponse.json(
          { error: "receivedQty must be positive" },
          { status: 400 },
        );

      const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        include: {
          rawMaterial: true,
          supplier: true,
          lines: { include: { rawMaterial: { select: { name: true, unit: true } } } },
        },
      });
      if (!po)
        return NextResponse.json({ error: "PO not found" }, { status: 404 });

      // Resolve the material shown in the audit trail (the line being received,
      // or the header material for legacy single-line POs).
      const poLines = po.lines || [];
      const shownLine =
        poLines.length > 1 && poLineId
          ? poLines.find((l: any) => l.id === poLineId)
          : poLines.length === 1
            ? poLines[0]
            : null;
      const shownMaterial = (shownLine as any)?.rawMaterial || po.rawMaterial;
      const shownName: string = shownMaterial?.name || "material";
      const shownUnit: string = shownMaterial?.unit || "units";

      const result = await prisma.$transaction(async (tx) => {
        if (clientId) {
          const reserved = await reserveIdempotency(tx as any, clientId, "/api/grn");
          if (!reserved) throw Object.assign(new Error("DUPLICATE"), { code: "DUPLICATE" });
        }

        const grnNumber = await nextSequenceTx(tx as any, "GRN", 4);

        // Re-read PO inside tx to avoid concurrent over-receipt drift
        const freshPo: any = await (tx as any).purchaseOrder.findUnique({
          where: { id: poId },
          include: { lines: { orderBy: { lineNo: "asc" } } },
        });
        if (!freshPo) throw new Error("PO not found");
        if (freshPo.status === "CANCELLED" || freshPo.status === "RECEIVED") {
          throw Object.assign(new Error(`Cannot receive items for PO in status ${freshPo.status}`), { code: "BAD_STATUS" });
        }

        // Resolve the PO line being received. POs created before multi-line
        // support have no line rows — synthesize one from the header mirror.
        let lines = freshPo.lines || [];
        if (lines.length === 0) {
          const synthesized: any = await (tx as any).purchaseOrderLine.create({
            data: {
              poId: freshPo.id,
              rawMaterialId: freshPo.rawMaterialId,
              lineNo: 1,
              qty: freshPo.qty,
              unitCost: freshPo.unitCost,
            },
          });
          lines = [synthesized];
        }
        let line: any;
        if (lines.length > 1) {
          if (!poLineId) {
            throw Object.assign(new Error("This PO has multiple lines — choose which line is being received"), { code: "LINE_REQUIRED" });
          }
          line = lines.find((l: any) => l.id === poLineId);
          if (!line) throw Object.assign(new Error("PO line not found"), { code: "LINE_NOT_FOUND" });
        } else {
          line = lines[0];
        }

        const grn = await (tx as any).goodsReceiptNote.create({
          data: {
            grnNumber,
            poId: freshPo.id,
            poLineId: line.id,
            supplierId: freshPo.supplierId,
            rawMaterialId: line.rawMaterialId,
            receivedQty: qty,
            receivedBy: userName,
            batchNo: batchNo || null,
            notes: notes || null,
          },
        });

        await (tx as any).rawMaterial.update({
          where: { id: line.rawMaterialId },
          data: { currentStock: { increment: qty } },
        });

        await (tx as any).inventoryTransaction.create({
          data: {
            rawMaterialId: line.rawMaterialId,
            type: "IN",
            qty,
            unitCost: line.unitCost,
            batchNo: batchNo || null,
            reference: grnNumber,
            actorName: userName,
          },
        });

        const newLineReceived = Number(line.receivedQty || 0) + qty;
        await (tx as any).purchaseOrderLine.update({
          where: { id: line.id },
          data: { receivedQty: newLineReceived },
        });

        const allLines = await (tx as any).purchaseOrderLine.findMany({ where: { poId: freshPo.id } });
        const newReceived = allLines.reduce((s: number, l: any) => s + Number(l.receivedQty || 0), 0);
        const poStatus = allLines.every((l: any) => Number(l.receivedQty || 0) >= Number(l.qty) - 0.001)
          ? "RECEIVED"
          : "PARTIAL";
        await (tx as any).purchaseOrder.update({
          where: { id: freshPo.id },
          data: { receivedQty: newReceived, receivedAt: new Date(), status: poStatus },
        });

        await (tx as any).auditLog.create({
          data: {
            actor: userName,
            action: "GRN_CREATED",
            entityType: "GRN",
            entityId: grn.id,
            details: `GRN ${grnNumber}: received ${qty} ${shownUnit} of ${shownName} against ${po.poNumber} (line ${line.lineNo || 1})`,
          },
        });

        return grn;
      });

      const payload = { success: true, item: result };
      if (clientId) await completeIdempotency(clientId, payload);
      return NextResponse.json(payload);
    }

    // ---- Supplier Invoice: creates invoice (+ line items), runs 3-way match ----
    if (body.entity === "invoice") {
      const {
        supplierId,
        poId,
        invoiceNumber,
        amount,
        taxAmount,
        invoiceDate,
        dueDate,
        notes,
        items,
      } = body.data || {};
      const itemList: any[] = Array.isArray(items) ? items : [];
      if (!supplierId || !invoiceNumber || (amount === undefined && itemList.length === 0)) {
        return NextResponse.json(
          { error: "supplierId, invoiceNumber and amount (or items) required" },
          { status: 400 },
        );
      }

      // Multi-material invoices: resolve payload items into line rows. Each
      // item may reference a PO line (poLineId) or a raw material directly.
      const poRows: any[] = [];
      for (let i = 0; i < itemList.length; i++) {
        const it = itemList[i];
        let rawMaterialId = it.rawMaterialId ? String(it.rawMaterialId) : null;
        const poLineId = it.poLineId ? String(it.poLineId) : null;
        const qty = Number(it.qty);
        const unitCost = Number(it.unitCost);
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
          return NextResponse.json(
            { error: `Line ${i + 1}: needs a positive qty and a valid unit cost` },
            { status: 400 },
          );
        }
        if (poLineId) {
          if (!poId) {
            return NextResponse.json(
              { error: `Line ${i + 1}: a poLineId needs a linked PO` },
              { status: 400 },
            );
          }
          const pol = await prisma.purchaseOrderLine.findFirst({
            where: { id: poLineId, poId: String(poId) },
            select: { rawMaterialId: true },
          });
          if (!pol) {
            return NextResponse.json(
              { error: `Line ${i + 1}: PO line not found on this PO` },
              { status: 400 },
            );
          }
          if (!rawMaterialId) rawMaterialId = pol.rawMaterialId;
        }
        if (!rawMaterialId) {
          return NextResponse.json(
            { error: `Line ${i + 1}: needs a rawMaterialId or poLineId` },
            { status: 400 },
          );
        }
        poRows.push({
          rawMaterialId,
          poLineId,
          lineNo: i + 1,
          qty,
          unitCost,
          amount: qty * unitCost,
        });
      }

      const linesValue = poRows.reduce((s: number, r: any) => s + r.amount, 0);
      let netAmount = amount !== undefined ? Number(amount) : linesValue;
      if (!Number.isFinite(netAmount) || netAmount < 0) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }
      if (poRows.length > 0) {
        const tol = Math.max(1, linesValue * (MATCH_TOLERANCE_PCT / 100));
        if (Math.abs(netAmount - linesValue) > tol) {
          return NextResponse.json(
            { error: `Amount ${netAmount} does not match the line total ${linesValue}` },
            { status: 400 },
          );
        }
        netAmount = linesValue; // line items are the source of truth
      }
      const tax = taxAmount ? Number(taxAmount) : 0;

      const created = await prisma.$transaction(async (tx) => {
        const inv = await (tx as any).supplierInvoice.create({
          data: {
            invoiceNumber,
            supplierId,
            poId: poId || null,
            amount: netAmount,
            taxAmount: tax,
            totalAmount: netAmount + tax,
            invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
            dueDate: dueDate ? new Date(dueDate) : null,
            notes: notes || null,
          },
        });
        if (poRows.length > 0) {
          await (tx as any).supplierInvoiceLine.createMany({
            data: poRows.map((r: any) => ({
              invoiceId: inv.id,
              poLineId: r.poLineId || null,
              rawMaterialId: r.rawMaterialId,
              lineNo: r.lineNo,
              qty: r.qty,
              unitCost: r.unitCost,
              amount: r.amount,
            })),
          });
        }
        return inv;
      });

      // Link to the latest GRN for the PO (if any) and run 3-way match
      let matchStatus = "UNMATCHED";
      if (poId) {
        const grn = await prisma.goodsReceiptNote.findFirst({
          where: { poId, supplierInvoice: { is: null } },
          orderBy: { receivedAt: "desc" },
        });
        if (grn) {
          const po = await prisma.purchaseOrder.findUnique({
            where: { id: poId },
            include: { lines: true },
          });
          await prisma.supplierInvoice.update({
            where: { id: created.id },
            data: { grnId: grn.id },
          });
          matchStatus = po
            ? computeMatch(grn, po, {
                amount: netAmount,
                taxAmount: tax,
                totalAmount: netAmount + tax,
                lines: poRows.map((r: any) => ({
                  lineNo: r.lineNo,
                  poLineId: r.poLineId || null,
                  qty: r.qty,
                  unitCost: r.unitCost,
                  amount: r.amount,
                })),
              })
            : "UNMATCHED";
          await prisma.goodsReceiptNote.update({
            where: { id: grn.id },
            data: { matchStatus: matchStatus as any },
          });
        }
      }
      const finalInv = await prisma.supplierInvoice.update({
        where: { id: created.id },
        data: {
          status:
            matchStatus === "MATCHED"
              ? "MATCHED"
              : matchStatus === "MISMATCHED"
                ? "MISMATCHED"
                : "UNPAID",
        },
      });

      // GL auto-post: purchase voucher — Dr Inventory (net), Dr GST ITC (tax),
      // Cr Accounts Payable. Best-effort; failures surface as GL_AUTOPOST_FAILED.
      if (netAmount + tax > 0.01) {
        const glLines = [
          {
            accountCode: "1050",
            debit: netAmount,
            reference: invoiceNumber,
            narration: "Goods purchases per supplier invoice",
          },
          ...(tax > 0.01
            ? [
                {
                  accountCode: "1040",
                  debit: tax,
                  reference: invoiceNumber,
                  narration: "Input GST credit (ITC)",
                },
              ]
            : []),
          {
            accountCode: "2010",
            credit: netAmount + tax,
            reference: invoiceNumber,
            narration: `Payable ${invoiceNumber}`,
          },
        ];
        await autoPostToGL({
          source: "VOUCHER",
          sourceId: created.id,
          memo: `Supplier invoice ${invoiceNumber} — purchases ${netAmount} + GST ${tax}`,
          createdBy: userName,
          date: invoiceDate ? new Date(invoiceDate) : new Date(),
          lines: glLines as any,
        });
      }

      await logAudit({
        actor: userName,
        action: "SUPPLIER_INVOICE_CREATED",
        entityType: "SUPPLIER_INVOICE",
        entityId: created.id,
        details: `Invoice ${invoiceNumber} (${netAmount + tax}) — 3-way match: ${matchStatus}${poRows.length > 0 ? `, ${poRows.length} line item(s)` : ""}`,
      });

      const withLines = await prisma.supplierInvoice.findUnique({
        where: { id: created.id },
        include: { lines: true },
      });
      return NextResponse.json({ success: true, item: withLines || finalInv });
    }

    // ---- Inspection decision on a GRN (M6 — IQC AQL) — ATOMIC ----
    if (body.entity === "inspect") {
      const { id, inspectionStatus, inspector, notes } = body.data || {};
      if (!["PASSED", "REJECTED"].includes(inspectionStatus)) {
        return NextResponse.json(
          { error: "inspectionStatus must be PASSED or REJECTED" },
          { status: 400 },
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        const existing = await (tx as any).goodsReceiptNote.findUnique({
          where: { id },
          include: {
            rawMaterial: { select: { sku: true, name: true, materialClass: true } },
            supplier: { select: { name: true } },
          },
        });
        if (!existing) throw Object.assign(new Error("GRN not found"), { code: "NOT_FOUND" });

        const aql = await (tx as any).aqlPlan.findUnique({
          where: { materialClass: existing.rawMaterial.materialClass || "C" },
        });
        const aqlSampleSize = aql?.sampleSize ?? null;

        let lotHeld = existing.lotHeld;
        let ncrId = existing.ncrId;
        let ncrNumber: string | null = null;
        if (inspectionStatus === "REJECTED") {
          lotHeld = true;
          if (!ncrId) {
            ncrNumber = await nextSequenceTx(tx as any, "NCR-SUP", 3);
            const ncr = await (tx as any).ncrReport.create({
              data: {
                ncrNumber,
                supplierId: existing.supplierId,
                grnId: existing.id,
                quantity: existing.receivedQty,
                severity: "HIGH",
                description: `IQC AQL rejection — GRN ${existing.grnNumber} (batch ${existing.batchNo || "—"}, ${existing.rawMaterial.sku}) failed incoming inspection. AQL class ${existing.rawMaterial.materialClass || "C"}, sample ${aqlSampleSize ?? "?"} pcs. Lot HELD pending supplier disposition.`,
                status: "OPEN",
                raisedBy: inspector || userName,
                raisedAt: new Date(),
              },
            });
            ncrId = ncr.id;
            await (tx as any).auditLog.create({
              data: {
                actor: inspector || userName,
                action: "NCR_RAISED",
                entityType: "NCR",
                entityId: ncr.id,
                details: `Auto-raised supplier NCR ${ncrNumber} from IQC rejection of GRN ${existing.grnNumber}`,
              },
            });
          }
        }

        const grn = await (tx as any).goodsReceiptNote.update({
          where: { id },
          data: {
            inspectionStatus,
            lotHeld,
            aqlSampleSize,
            ncrId,
            inspector: inspector || userName,
            inspectedAt: new Date(),
            notes: notes || undefined,
          },
        });

        await (tx as any).auditLog.create({
          data: {
            actor: userName,
            action: "GRN_INSPECTED",
            entityType: "GRN",
            entityId: grn.id,
            details: `GRN ${grn.grnNumber} — ${inspectionStatus}${lotHeld ? " · LOT HELD + supplier NCR draft" : ""} (AQL ${aqlSampleSize ?? "n/a"} pcs)`,
          },
        });

        return { grn, aqlSampleSize, lotHeld, ncrId };
      });

      if ((result as any)?.code === "NOT_FOUND") {
        return NextResponse.json({ error: "GRN not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, item: { ...result.grn, aqlSampleSize: result.aqlSampleSize, lotHeld: result.lotHeld, ncrId: result.ncrId } });
    }

    // ---- M6 — AQL plan upsert (sampling table per material class) ----
    if (body.entity === "aql-plan") {
      const {
        materialClass,
        aqlLevel,
        sampleSize,
        acceptanceNumber,
        rejectionNumber,
        description,
      } = body.data || {};
      if (!materialClass || !["A", "B", "C"].includes(materialClass)) {
        return NextResponse.json(
          { error: "materialClass must be A, B or C" },
          { status: 400 },
        );
      }
      const sample = Number(sampleSize);
      const ac = Number(acceptanceNumber);
      const re = Number(rejectionNumber);
      if (!sample || sample <= 0 || ac == null || re == null || re <= ac) {
        return NextResponse.json(
          {
            error:
              "valid sampleSize and rejectionNumber > acceptanceNumber required",
          },
          { status: 400 },
        );
      }
      const plan = await prisma.aqlPlan.upsert({
        where: { materialClass },
        update: {
          aqlLevel: aqlLevel || "II",
          sampleSize: sample,
          acceptanceNumber: ac,
          rejectionNumber: re,
          description: description || null,
        },
        create: {
          materialClass,
          aqlLevel: aqlLevel || "II",
          sampleSize: sample,
          acceptanceNumber: ac,
          rejectionNumber: re,
          description: description || null,
        },
      });
      await logAudit({
        actor: userName,
        action: "AQL_PLAN_UPDATED",
        entityType: "AQL_PLAN",
        entityId: plan.id,
        details: `AQL class ${materialClass} — sample ${sample}, Ac ${ac}/Re ${re}`,
      });
      return NextResponse.json({ success: true, item: plan });
    }

    // ---- Payment against a matched supplier invoice (ATOMIC) ----
    if (body.entity === "pay") {
      const { id, amount, method, reference } = body.data || {};
      const inv = await prisma.supplierInvoice.findUnique({
        where: { id },
        include: { lines: { orderBy: { lineNo: "asc" } } },
      });
      if (!inv)
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 },
        );
      const po = inv.poId
        ? await prisma.purchaseOrder.findUnique({ where: { id: inv.poId }, include: { lines: true } })
        : null;
      const grnInv = inv.grnId ? await prisma.goodsReceiptNote.findUnique({ where: { id: inv.grnId } }) : null;
      const match = computeMatch(grnInv || { receivedQty: 0 }, po || { qty: 0, unitCost: 0 }, inv);
      if (match !== "MATCHED") {
        return NextResponse.json(
          {
            error: `Payment blocked — 3-way match is ${match}. PO, GRN and invoice must agree before payment.`,
            code: "THREE_WAY_BLOCKED",
            matchStatus: match,
          },
          { status: 403 },
        );
      }
      const payAmount = amount ? Number(amount) : inv.totalAmount;
      let treasuryId: string | null = null;
      const updated = await prisma.$transaction(async (tx) => {
        if (clientId) {
          const reserved = await reserveIdempotency(tx as any, clientId, "/api/grn:pay");
          if (!reserved) throw Object.assign(new Error("DUPLICATE"), { code: "DUPLICATE" });
        }
        const freshInv = await (tx as any).supplierInvoice.findUnique({ where: { id } });
        if (!freshInv) throw new Error("Invoice not found");
        if (freshInv.status === "PAID") return freshInv; // idempotent pay replay
        const u = await (tx as any).supplierInvoice.update({
          where: { id },
          data: {
            status: "PAID",
            notes: reference ? `${freshInv.notes || ""} Ref: ${reference}`.trim() : freshInv.notes,
          },
        });
        const tt = await (tx as any).treasuryTransaction.create({
          data: {
            type: "OUTFLOW",
            account: "Main",
            amount: payAmount,
            reference: freshInv.invoiceNumber,
            category: "Supplier Payment",
            notes: `Paid ${freshInv.invoiceNumber} (3-way matched) via ${method || "Bank"}`,
          },
        });
        treasuryId = tt.id;
        await (tx as any).auditLog.create({
          data: {
            actor: userName,
            action: "SUPPLIER_PAYMENT",
            entityType: "SUPPLIER_INVOICE",
            entityId: freshInv.id,
            details: `Paid ${freshInv.invoiceNumber} ${payAmount} (3-way matched)`,
          },
        });
        return u;
      });
      // GL auto-post: Dr Accounts Payable, Cr Bank for the settled amount
      const glVoucher = await prisma.journalEntry.findFirst({
        where: { source: "VOUCHER", sourceId: inv.id },
        select: { id: true },
      });
      if (treasuryId && payAmount > 0 && glVoucher) {
        await autoPostToGL({
          source: "PAYMENT",
          sourceId: treasuryId,
          memo: `Supplier payment ${updated.invoiceNumber} via ${method || "Bank"}`,
          createdBy: userName,
          lines: [
            {
              accountCode: "2010",
              debit: payAmount,
              reference: updated.invoiceNumber,
              narration: `Settled ${updated.invoiceNumber}`,
            },
            {
              accountCode: "1020",
              credit: payAmount,
              reference: updated.invoiceNumber,
              narration: `Bank — ${method || "Main"}`,
            },
          ],
        });
      }

      const payloadPay = { success: true, item: updated };
      if (clientId) await completeIdempotency(clientId, payloadPay);
      return NextResponse.json(payloadPay);
    }

    return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  } catch (error: any) {
    if (error?.code === "DUPLICATE") {
      return NextResponse.json({ success: true, duplicate: true, message: "Duplicate request ignored (idempotent)" });
    }
    if (error?.code === "LINE_REQUIRED" || error?.code === "LINE_NOT_FOUND" || error?.code === "BAD_STATUS") {
      return NextResponse.json({ error: error?.message || "Bad request" }, { status: 400 });
    }
    console.error("POST /api/grn error:", error);
    return NextResponse.json(
      { error: "Failed to save" },
      { status: 500 },
    );
  }
}
