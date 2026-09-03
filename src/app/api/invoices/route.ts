import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateTax } from "@/lib/invoicingEngine";
import { parseOr400 } from "@/lib/validate";
import { nextSequenceTx } from "@/lib/sequence";
import { checkIdempotency, reserveIdempotency, completeIdempotency } from "@/lib/idempotency";
import { z } from "zod";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { autoPostToGL } from "@/lib/glPosting";
import { computeSalesOrderFulfilment } from "@/lib/salesOrders";
import { toPaiseRow, fromPaiseRow, fromPaiseRows } from "@/lib/money";

export const dynamic = "force-dynamic";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export async function GET() {
  try {
    const invoices = await (prisma as any).invoice.findMany({
      include: {
        dispatchRecord: {
          select: {
            id: true,
            challanNumber: true,
            dispatchedQty: true,
            dispatchedAt: true,
          },
        },
        workOrder: {
          select: {
            id: true,
            woNumber: true,
            quotedPrice: true,
            plannedQuantity: true,
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                sellingPricePerUnit: true,
              },
            },
          },
        },
        salesOrder: { select: { id: true, orderNumber: true } },
        lines: { orderBy: { lineNo: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Ledger-style fixed point: rows store paise — expose the rupee contract.
    const invoicesRupees = invoices.map((inv: any) => ({
      ...fromPaiseRow("Invoice", inv),
      lines: Array.isArray(inv.lines) ? fromPaiseRows("InvoiceLine", inv.lines) : inv.lines,
    }));
    return NextResponse.json({ invoices: invoicesRupees });
  } catch (error: any) {
    console.error("GET /api/invoices error:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 },
    );
  }
}

const invoiceCreateSchema = z
  .object({
    // Dispatch mode: bill one dispatch record (legacy) or a whole work order
    dispatchRecordId: z.string().min(1).optional().nullable(),
    workOrderId: z.string().min(1).optional().nullable(),
    // Sales-order mode: bill open SalesOrderLine rows directly
    salesOrderId: z.string().min(1).optional().nullable(),
    // Optional per-line quantity overrides when billing an SO (partial billing)
    lineQtys: z
      .array(
        z.object({
          salesOrderLineId: z.string().min(1),
          qty: z.coerce.number().positive(),
        }),
      )
      .optional()
      .nullable(),
    customerName: z.string().max(200).optional().nullable(),
    customerAddress: z.string().max(500).optional().nullable(),
    customerGstin: z.string().max(50).optional().nullable(),
    taxType: z.enum(["INTRA", "INTER"]).optional().default("INTRA"),
    taxRatePct: z.coerce.number().min(0).max(28).optional().default(18),
    dueDate: z.string().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    clientId: z.string().max(200).optional().nullable(),
  })
  .refine(
    (d) => d.dispatchRecordId || d.workOrderId || d.salesOrderId,
    {
      message:
        "dispatchRecordId, workOrderId or salesOrderId is required",
      path: ["dispatchRecordId"],
    },
  );

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    const actor = user.name || user.id || "System";
    const headerClientId = headersList.get("x-client-id");
    const clientId: string | null =
      (body.clientId ? String(body.clientId).trim() : null) ||
      (headerClientId ? String(headerClientId).trim() : null);
    if (clientId) {
      const dup = await checkIdempotency(clientId);
      if (dup.duplicate) {
        const cached: any = (dup.existing as any)?.response;
        if (cached) return NextResponse.json(cached);
        return NextResponse.json({
          success: true,
          duplicate: true,
          message: "Duplicate invoice request ignored",
        });
      }
    }

    const parsed = parseOr400(invoiceCreateSchema, body);
    if (!parsed.ok) return parsed.response;
    const {
      dispatchRecordId,
      workOrderId,
      salesOrderId,
      lineQtys,
      customerName,
      customerAddress,
      customerGstin,
      taxType = "INTRA",
      taxRatePct = 18,
      dueDate,
      notes,
    } = parsed.data as any;

    try {
      const result = await prisma.$transaction(async (tx) => {
        if (clientId) {
          const reserved = await reserveIdempotency(
            tx as any,
            clientId,
            "/api/invoices",
          );
          if (!reserved)
            throw Object.assign(new Error("DUPLICATE"), {
              code: "DUPLICATE",
            });
        }

        const rate = Number(taxRatePct);
        const taxKind: "INTRA" | "INTER" = taxType;

        // Build one line-row from a resolved product/qty/price and a unit of tax.
        const lineFrom = (
          lineNo: number,
          input: {
            productId?: string | null;
            productName: string;
            productSku?: string | null;
            qty: number;
            unitPrice: number;
          },
        ) => {
          const taxableValue = round2(Number(input.qty) * Number(input.unitPrice));
          const t = calculateTax(taxableValue, taxKind, rate);
          return {
            lineNo,
            productId: input.productId || null,
            productName: input.productName,
            productSku: input.productSku || null,
            qty: Number(input.qty),
            unitPrice: Number(input.unitPrice),
            taxableValue: t.taxableValue,
            taxRatePct: t.taxRatePct,
            cgstAmt: t.cgstAmt,
            sgstAmt: t.sgstAmt,
            igstAmt: t.igstAmt,
            totalValue: t.totalValue,
            salesOrderLineId: null as string | null,
          };
        };

        let invoiceNumber = "";
        let created: any = null;
        let lines: any[] = [];
        let dispatchRecordTx: any = null;
        let workOrderTx: any = null;

        if (dispatchRecordId || workOrderId) {
          // ---------- DISPATCH MODE (legacy single document → one line) ----------
          if (dispatchRecordId) {
            const existing = await (tx as any).invoice.findUnique({
              where: { dispatchRecordId },
            });
            if (existing)
              throw Object.assign(
                new Error(
                  `An invoice (${existing.invoiceNumber}) already exists for this dispatch.`,
                ),
                { code: "ALREADY_EXISTS" },
              );
            dispatchRecordTx = await (tx as any).dispatchRecord.findUnique({
              where: { id: dispatchRecordId },
              include: { workOrder: { include: { product: true } } },
            });
            if (!dispatchRecordTx)
              throw Object.assign(
                new Error("Dispatch record not found"),
                { code: "NOT_FOUND_DISPATCH" },
              );
            workOrderTx = dispatchRecordTx.workOrder;
          } else if (workOrderId) {
            workOrderTx = await (tx as any).workOrder.findUnique({
              where: { id: workOrderId },
              include: { product: true },
            });
          }
          if (!workOrderTx)
            throw Object.assign(new Error("Work Order not found"), {
              code: "NOT_FOUND_WO",
            });

          if (workOrderTx.projectId) {
            const openMilestones = await (tx as any).projectMilestone.count({
              where: {
                projectId: workOrderTx.projectId,
                status: { not: "COMPLETED" },
              },
            });
            if (openMilestones > 0)
              throw Object.assign(
                new Error(
                  `Milestone gate: ${openMilestones} milestone(s) on this project are not COMPLETED — complete milestones (and their doc packs) before invoicing.`,
                ),
                { code: "MILESTONE_GATE" },
              );
          }

          const qty = dispatchRecordTx
            ? dispatchRecordTx.dispatchedQty
            : workOrderTx.plannedQuantity;
          let unitPrice = 0;
          if (workOrderTx.quotedPrice && workOrderTx.plannedQuantity > 0)
            unitPrice = workOrderTx.quotedPrice / workOrderTx.plannedQuantity;
          else if (workOrderTx.product?.sellingPricePerUnit)
            unitPrice = workOrderTx.product.sellingPricePerUnit;
          else unitPrice = 100.0;

          const line = lineFrom(1, {
            productId: workOrderTx.product?.id,
            productName:
              workOrderTx.product?.name || workOrderTx.woNumber || "Finished Goods",
            productSku: workOrderTx.product?.sku,
            qty,
            unitPrice,
          });
          lines = [line];

          // Optional trace to a SalesOrder line whose product matches this WO
          if (salesOrderId && workOrderTx.product?.id) {
            const so = await (tx as any).salesOrder.findUnique({
              where: { id: salesOrderId },
              include: { lines: true },
            });
            if (!so)
              throw Object.assign(new Error("Sales order not found"), {
                code: "NOT_FOUND_SO",
              });
            const candidate = so.lines.find(
              (l: any) =>
                l.productId === workOrderTx.product.id &&
                Number(l.quantity) - Number(l.invoicedQty || 0) >= qty - 0.001,
            );
            if (!candidate)
              throw Object.assign(
                new Error(
                  `Sales order ${so.orderNumber} has no line with enough open qty for product ${workOrderTx.product.sku || workOrderTx.product.name}`,
                ),
                { code: "SO_LINE_MISMATCH" },
              );
            line.salesOrderLineId = candidate.id;
            await (tx as any).salesOrderLine.update({
              where: { id: candidate.id },
              data: {
                invoicedQty: Number(candidate.invoicedQty || 0) + qty,
              },
            });
            if (
              so.lines.every(
                (l: any) =>
                  Number(l.invoicedQty || 0) + (l.id === candidate.id ? qty : 0) >=
                  Number(l.quantity) - 0.001,
              )
            ) {
              await (tx as any).salesOrder.update({
                where: { id: so.id },
                data: { status: "INVOICED" },
              });
              await (tx as any).auditLog.create({
                data: {
                  actor,
                  action: "SO_INVOICED",
                  entityType: "SalesOrder",
                  entityId: so.id,
                  details: `Sales order ${so.orderNumber} fully invoiced — dispatch ${dispatchRecordTx?.challanNumber || "work order"} billed`,
                },
              });
            }
          }

          invoiceNumber = await nextSequenceTx(tx as any, "INV", 3);
          created = await (tx as any).invoice.create({
            data: toPaiseRow("Invoice", {
              invoiceNumber,
              dispatchRecordId: dispatchRecordId || null,
              workOrderId: workOrderTx.id,
              salesOrderId: salesOrderId || null,
              customerName:
                customerName ||
                workOrderTx.customerName ||
                "Valued Customer",
              customerAddress: customerAddress || null,
              customerGstin: customerGstin || null,
              invoiceDate: new Date(),
              taxableValue: lines[0].taxableValue,
              taxType: taxKind,
              taxRatePct: rate,
              cgstAmt: lines[0].cgstAmt,
              sgstAmt: lines[0].sgstAmt,
              igstAmt: lines[0].igstAmt,
              totalValue: lines[0].totalValue,
              dueDate: dueDate
                ? new Date(dueDate)
                : new Date(Date.now() + 30 * 86400000),
              status: "UNPAID",
              notes: notes || null,
              lines: { create: lines.map((l: any) => toPaiseRow("InvoiceLine", l)) },
            }),
            include: {
              dispatchRecord: true,
              workOrder: { include: { product: true } },
              salesOrder: { select: { id: true, orderNumber: true } },
              lines: { orderBy: { lineNo: "asc" } },
            },
          });
        } else if (salesOrderId) {
          // ---------- SALES-ORDER MODE (itemized billing of SO lines) ----------
          const so = await (tx as any).salesOrder.findUnique({
            where: { id: salesOrderId },
            include: { lines: { orderBy: { createdAt: "asc" } }, customer: true },
          });
          if (!so)
            throw Object.assign(new Error("Sales order not found"), {
              code: "NOT_FOUND_SO",
            });

          const overrides = new Map<string, number>();
          for (const o of lineQtys || []) overrides.set(o.salesOrderLineId, Number(o.qty));
          const explicit = overrides.size > 0; // lineQtys given → bill only those lines

          // Only lines with open qty can be billed (and only requested ones when explicit)
          const open = so.lines.filter((l: any) => {
            const remaining = Number(l.quantity) - Number(l.invoicedQty || 0);
            if (remaining <= 0.001) return false;
            return !explicit || overrides.has(l.id);
          });
          if (open.length === 0) {
            // Self-heal: a SalesOrder whose lines are ALL fully invoiced should
            // read INVOICED even when the billing that completed it happened in an
            // earlier session (e.g. pre-self-heal data). Flip it and return a
            // notice instead of a hard error so the order book heals itself.
            const { allInvoiced, healableToInvoiced: healable } =
              computeSalesOrderFulfilment(so.status, so.lines);
            if (allInvoiced && healable && so.status !== "INVOICED") {
              await (tx as any).salesOrder.update({
                where: { id: so.id },
                data: { status: "INVOICED" },
              });
              await (tx as any).auditLog.create({
                data: {
                  actor,
                  action: "SO_INVOICED",
                  entityType: "SalesOrder",
                  entityId: so.id,
                  details: `Sales order ${so.orderNumber} — all lines were already fully invoiced; status healed to INVOICED`,
                },
              });
            }
            if (allInvoiced && healable) {
              return {
                invoice: null,
                healed: true,
                orderNumber: so.orderNumber,
                message: `Sales order ${so.orderNumber} is already fully invoiced — marked INVOICED.`,
              };
            }
            throw Object.assign(
              new Error(`Sales order ${so.orderNumber} has no open lines left to bill`),
              { code: "NOTHING_TO_BILL" },
            );
          }

          let lineNo = 1;
          const billedMap = new Map<string, number>();
          const totals = { taxableValue: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0, totalValue: 0 };
          for (const l of open) {
            const remaining = Number(l.quantity) - Number(l.invoicedQty || 0);
            let billQty = overrides.has(l.id)
              ? overrides.get(l.id)!
              : remaining;
            billQty = round2(Math.min(billQty, remaining));
            if (billQty <= 0) continue;
            // scale the full-line discount to the billed fraction
            const fraction = billQty / Number(l.quantity);
            const netUnit =
              Number(l.unitPrice) -
              (Number(l.discountAmt || 0) * fraction) / billQty;
            const line = lineFrom(lineNo++, {
              productId: l.productId,
              productName: l.productName,
              productSku: l.productCode || null,
              qty: billQty,
              unitPrice: round2(netUnit),
            });
            line.salesOrderLineId = l.id;
            lines.push(line);
            totals.taxableValue += line.taxableValue;
            totals.cgstAmt += line.cgstAmt;
            totals.sgstAmt += line.sgstAmt;
            totals.igstAmt += line.igstAmt;
            totals.totalValue += line.totalValue;
            billedMap.set(l.id, (billedMap.get(l.id) || 0) + billQty);
            await (tx as any).salesOrderLine.update({
              where: { id: l.id },
              data: { invoicedQty: round2(Number(l.invoicedQty || 0) + billQty) },
            });
          }
          if (lines.length === 0)
            throw Object.assign(
              new Error("No billable quantity selected"),
              { code: "NOTHING_TO_BILL" },
            );

          // Status ladder computed from prior invoiced qty + what THIS invoice added
          const fullyInvoiced = so.lines.every((l: any) => {
            const prior = Number(l.invoicedQty || 0);
            return prior + (billedMap.get(l.id) || 0) >= Number(l.quantity) - 0.001;
          });
          const anyInvoiced = so.lines.some(
            (l: any) =>
              Number(l.invoicedQty || 0) > 0 || (billedMap.get(l.id) || 0) > 0,
          );

          invoiceNumber = await nextSequenceTx(tx as any, "INV", 3);
          created = await (tx as any).invoice.create({
            data: toPaiseRow("Invoice", {
              invoiceNumber,
              dispatchRecordId: null,
              workOrderId: null,
              salesOrderId: so.id,
              customerName:
                customerName || so.customerName || so.customer?.name || "Valued Customer",
              customerAddress: customerAddress || null,
              customerGstin: customerGstin || null,
              invoiceDate: new Date(),
              taxableValue: round2(totals.taxableValue),
              taxType: taxKind,
              taxRatePct: rate,
              cgstAmt: round2(totals.cgstAmt),
              sgstAmt: round2(totals.sgstAmt),
              igstAmt: round2(totals.igstAmt),
              totalValue: round2(totals.totalValue),
              dueDate: dueDate
                ? new Date(dueDate)
                : new Date(Date.now() + 30 * 86400000),
              status: "UNPAID",
              notes: notes || null,
              lines: { create: lines.map((l: any) => toPaiseRow("InvoiceLine", l)) },
            }),
            include: {
              dispatchRecord: true,
              workOrder: { include: { product: true } },
              salesOrder: { select: { id: true, orderNumber: true } },
              lines: { orderBy: { lineNo: "asc" } },
            },
          });

          // Advance the SO status along the fulfilment ladder
          let nextStatus: string | null = null;
          if (fullyInvoiced) nextStatus = "INVOICED";
          else if (anyInvoiced && ["CONFIRMED", "IN_PRODUCTION"].includes(so.status))
            nextStatus = "PARTIALLY_DISPATCHED";
          if (nextStatus) {
            await (tx as any).salesOrder.update({
              where: { id: so.id },
              data: { status: nextStatus },
            });
            await (tx as any).auditLog.create({
              data: {
                actor,
                action: nextStatus === "INVOICED" ? "SO_INVOICED" : "SO_PARTIALLY_INVOICED",
                entityType: "SalesOrder",
                entityId: so.id,
                details: `Sales order ${so.orderNumber} — billed ${lines.length} line(s) on ${invoiceNumber} (₹${round2(totals.totalValue).toLocaleString("en-IN")}) → ${nextStatus}`,
              },
            });
          }
        }

        await (tx as any).auditLog.create({
          data: {
            actor,
            action: "CREATED_INVOICE",
            entityType: "Invoice",
            entityId: created.id,
            details: JSON.stringify({
              invoiceNumber,
              customerName: created.customerName,
              totalValue: created.totalValue,
              lineItems: lines.length,
            }),
          },
        });

        return {
          invoice: {
            ...fromPaiseRow("Invoice", created),
            lines: Array.isArray(created.lines)
              ? fromPaiseRows("InvoiceLine", created.lines)
              : created.lines,
          },
          taxCalc: null,
          lineItems: lines.length,
        };
      });

      // GL auto-post: Dr Accounts Receivable, Cr Sales, Cr GST Output
      // (GL lines are built from the RUpee view of the stored paise row.)
      const createdInv = fromPaiseRow("Invoice", result.invoice);
      if (createdInv && Number(createdInv.totalValue) > 0.01) {
        const outTax =
          Number(createdInv.cgstAmt || 0) +
          Number(createdInv.sgstAmt || 0) +
          Number(createdInv.igstAmt || 0);
        const glLines: any[] = [
          {
            accountCode: "1030",
            debit: Number(createdInv.totalValue),
            reference: createdInv.invoiceNumber,
            narration: `Receivable ${createdInv.invoiceNumber}`,
          },
          {
            accountCode: createdInv.taxType === "INTER" ? "4020" : "4010",
            credit: Number(createdInv.taxableValue),
            reference: createdInv.invoiceNumber,
            narration: `Sales — ${createdInv.customerName || "customer"}`,
          },
          ...(outTax > 0.01
            ? [
                {
                  accountCode: "2020",
                  credit: outTax,
                  reference: createdInv.invoiceNumber,
                  narration: "GST output collected",
                },
              ]
            : []),
        ];
        await autoPostToGL({
          source: "INVOICE",
          sourceId: createdInv.id,
          memo: `Sales invoice ${createdInv.invoiceNumber} — ${createdInv.customerName || "customer"} (${Number(createdInv.totalValue).toFixed(2)})`,
          createdBy: actor,
          date: createdInv.invoiceDate ? new Date(createdInv.invoiceDate) : undefined,
          lines: glLines,
        });
      }

      if (clientId) await completeIdempotency(clientId, result);
      return NextResponse.json(result, { status: 201 });
    } catch (error: any) {
      if (error?.code === "DUPLICATE")
        return NextResponse.json({
          success: true,
          duplicate: true,
          message: "Duplicate invoice request ignored",
        });
      const codeToStatus: Record<string, number> = {
        ALREADY_EXISTS: 400,
        NOT_FOUND_DISPATCH: 404,
        NOT_FOUND_WO: 404,
        NOT_FOUND_SO: 404,
        MILESTONE_GATE: 400,
        SO_LINE_MISMATCH: 400,
        NOTHING_TO_BILL: 400,
      };
      if (error?.code && codeToStatus[error.code]) {
        return NextResponse.json(
          { error: error?.message || "Invoice creation failed", code: error.code },
          { status: codeToStatus[error.code] },
        );
      }
      throw error;
    }
  } catch (error: any) {
    console.error("POST /api/invoices error:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 },
    );
  }
}
