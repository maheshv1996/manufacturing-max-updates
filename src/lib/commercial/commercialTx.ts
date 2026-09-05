/**
 * C6-5 — Typed commercial transaction adapters (DEPTH_04 W5/W6).
 * Every mutation runs the pure engine first and only then writes,
 * inside one `$transaction`, guarded by the C1 idempotency core when a
 * clientId is present, with in-tx audit rows. No `as any`; the engine is the
 * only source of truth for transitions.
 */

import type { PrismaClient, Prisma } from "@prisma/client";
import { AppError, notFound, validation } from "../core/errors";
import { runIdempotent } from "../core/integrityDb";
import { buildAuditEvent, type AuditEventInput } from "../core/audit";
import { transitionQuotation, type QuotationAction, type QuotationStatus } from "./quotations";
import { transitionSalesOrder, type SalesOrderAction, type SalesOrderStatus } from "./salesOrders";
import { transitionInvoice, type InvoiceAction, type InvoiceStatus } from "./invoices";
import { transitionPayment, type PaymentAction } from "./payments";

type Tx = Prisma.TransactionClient;

type DBSalesOrderStatus = "DRAFT" | "CONFIRMED" | "IN_PRODUCTION" | "PARTIALLY_DISPATCHED" | "DISPATCHED" | "INVOICED" | "CANCELLED";
type DBInvoiceStatus = "UNPAID" | "PARTIAL" | "PAID";

async function audit(tx: Tx, actorName: string, input: AuditEventInput): Promise<void> {
  const ev = buildAuditEvent(input);
  await tx.auditLog.create({
    data: {
      actor: ev.actor || actorName,
      action: ev.action,
      entityType: ev.entityType,
      entityId: ev.entityId,
      details: ev.details ?? "",
      at: ev.at,
    },
  });
}

export interface CommercialActor {
  id: string;
  name?: string;
}

async function withIdempotency<T>(
  db: PrismaClient,
  clientId: string | undefined,
  scope: string,
  fn: () => Promise<T>,
): Promise<{ duplicate: boolean; value?: T }> {
  if (!clientId?.trim()) return { duplicate: false, value: await fn() };
  const r = await runIdempotent(db, { clientId, scope }, fn);
  return r.applied ? { duplicate: false, value: r.value } : { duplicate: true };
}

const castStatus = <T extends string>(s: string, allowed: readonly T[]): T => {
  if (!(allowed as readonly string[]).includes(s)) throw validation(`Unknown status ${s}`);
  return s as T;
};

const toEngineSalesOrderStatus = (s: string): SalesOrderStatus => {
  const map: Record<string, SalesOrderStatus> = {
    DRAFT: "DRAFT",
    CONFIRMED: "CONFIRMED",
    IN_PRODUCTION: "IN_PROGRESS",
    PARTIALLY_DISPATCHED: "IN_PROGRESS",
    DISPATCHED: "COMPLETED",
    INVOICED: "COMPLETED",
    CANCELLED: "CANCELLED",
  };
  return map[s] || "DRAFT";
};

const fromEngineSalesOrderStatus = (s: SalesOrderStatus): DBSalesOrderStatus => {
  const map: Record<SalesOrderStatus, DBSalesOrderStatus> = {
    DRAFT: "DRAFT",
    CONFIRMED: "CONFIRMED",
    IN_PROGRESS: "IN_PRODUCTION",
    COMPLETED: "INVOICED",
    CANCELLED: "CANCELLED",
  };
  return map[s];
};

const toEngineInvoiceStatus = (s: string): InvoiceStatus => {
  const map: Record<string, InvoiceStatus> = {
    UNPAID: "DRAFT",
    PARTIAL: "PARTIAL",
    PAID: "PAID",
  };
  return map[s] || "DRAFT";
};

const fromEngineInvoiceStatus = (s: InvoiceStatus): DBInvoiceStatus => {
  const map: Record<InvoiceStatus, DBInvoiceStatus> = {
    DRAFT: "UNPAID",
    SENT: "UNPAID",
    PARTIAL: "PARTIAL",
    PAID: "PAID",
    OVERDUE: "UNPAID",
  };
  return map[s];
};

// ------------------------------------------------------------------ QUOTATION ----

export interface CreateQuotationInput {
  actor: CommercialActor;
  clientId?: string;
  quoteNumber: string;
  customerName: string;
  customerContact?: string;
  validUntil?: Date;
  estimatedCost: number;
  quotedPrice: number;
  notes?: string;
  workOrderId?: string;
  lines: Array<{ productId: string; plannedQty: number; unitPrice: number; subtotal: number }>;
}

export async function createQuotation(db: PrismaClient, input: CreateQuotationInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const created = await tx.quotation.create({
        data: {
          quoteNumber: input.quoteNumber,
          customerName: input.customerName,
          customerContact: input.customerContact,
          validUntil: input.validUntil,
          estimatedCost: input.estimatedCost,
          quotedPrice: input.quotedPrice,
          notes: input.notes,
          workOrderId: input.workOrderId,
          status: "DRAFT",
          lines: {
            create: input.lines.map((l) => ({
              productId: l.productId,
              plannedQty: l.plannedQty,
              unitPrice: l.unitPrice,
              subtotal: l.subtotal,
            })),
          },
        },
        select: { id: true, quoteNumber: true, status: true },
      });
      await audit(tx, input.actor.name ?? "Commercial", {
        actor: input.actor.id,
        action: "QUOTATION_CREATED",
        entityType: "Quotation",
        entityId: created.id,
        details: JSON.stringify({ quoteNumber: created.quoteNumber, customer: input.customerName }),
      });
      return created;
    });
  const r = await withIdempotency(db, input.clientId, "commercial:quotation:create", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

export interface QuotationTransitionInput {
  actor: CommercialActor;
  clientId?: string;
  quotationId: string;
  action: QuotationAction;
}

export async function transitionQuotationTx(db: PrismaClient, input: QuotationTransitionInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const q = await tx.quotation.findUnique({
        where: { id: input.quotationId },
        select: { id: true, quoteNumber: true, status: true },
      });
      if (!q) throw notFound("Quotation not found");
      const gate = transitionQuotation(castStatus<QuotationStatus>(q.status, ["DRAFT", "SENT", "WON", "LOST", "CONVERTED"]), input.action);
      if (!gate.ok) throw new AppError("VALIDATION", gate.message, { details: { code: gate.code } });

      const updated = await tx.quotation.update({
        where: { id: q.id },
        data: { status: gate.status },
        select: { id: true, quoteNumber: true, status: true },
      });

      await audit(tx, input.actor.name ?? "Commercial", {
        actor: input.actor.id,
        action: `QUOTATION_${gate.status}`,
        entityType: "Quotation",
        entityId: q.id,
        details: `${q.status} -> ${gate.status}`,
      });
      return updated;
    });
  const r = await withIdempotency(db, input.clientId, `commercial:quotation:${input.action.action}`, run);
  return r.duplicate ? { duplicate: true } : r.value;
}

// ------------------------------------------------------------------ SALES ORDER ----

export interface CreateSalesOrderInput {
  actor: CommercialActor;
  clientId?: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  expectedDelivery?: Date;
  poReference?: string;
  paymentTerms?: string;
  currency?: string;
  notes?: string;
  lines: Array<{ productId?: string; productCode?: string; productName: string; quantity: number; unitPrice: number; discountPct?: number; taxPct?: number }>;
}

export async function createSalesOrder(db: PrismaClient, input: CreateSalesOrderInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const created = await tx.salesOrder.create({
        data: {
          orderNumber: input.orderNumber,
          customerId: input.customerId,
          customerName: input.customerName,
          expectedDelivery: input.expectedDelivery,
          poReference: input.poReference,
          paymentTerms: input.paymentTerms,
          currency: input.currency ?? "INR",
          notes: input.notes,
          createdBy: input.actor.id,
          status: "DRAFT",
          lines: {
            create: input.lines.map((l) => ({
              productId: l.productId,
              productCode: l.productCode,
              productName: l.productName,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountPct: l.discountPct ?? 0,
              taxPct: l.taxPct ?? 0,
            })),
          },
        },
        select: { id: true, orderNumber: true, status: true },
      });
      await audit(tx, input.actor.name ?? "Commercial", {
        actor: input.actor.id,
        action: "SALES_ORDER_CREATED",
        entityType: "SalesOrder",
        entityId: created.id,
        details: JSON.stringify({ orderNumber: created.orderNumber, customer: input.customerName }),
      });
      return created;
    });
  const r = await withIdempotency(db, input.clientId, "commercial:salesorder:create", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

export interface SalesOrderTransitionInput {
  actor: CommercialActor;
  clientId?: string;
  salesOrderId: string;
  action: SalesOrderAction;
}

export async function transitionSalesOrderTx(db: PrismaClient, input: SalesOrderTransitionInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const so = await tx.salesOrder.findUnique({
        where: { id: input.salesOrderId },
        select: { id: true, orderNumber: true, status: true },
      });
      if (!so) throw notFound("Sales order not found");
      const gate = transitionSalesOrder(toEngineSalesOrderStatus(so.status), input.action);
      if (!gate.ok) throw new AppError("VALIDATION", gate.message, { details: { code: gate.code } });

      const updated = await tx.salesOrder.update({
        where: { id: so.id },
        data: { status: fromEngineSalesOrderStatus(gate.status) as DBSalesOrderStatus },
        select: { id: true, orderNumber: true, status: true },
      });

      await audit(tx, input.actor.name ?? "Commercial", {
        actor: input.actor.id,
        action: `SALES_ORDER_${gate.status}`,
        entityType: "SalesOrder",
        entityId: so.id,
        details: `${so.status} -> ${gate.status}`,
      });
      return updated;
    });
  const r = await withIdempotency(db, input.clientId, `commercial:salesorder:${input.action.action}`, run);
  return r.duplicate ? { duplicate: true } : r.value;
}

// ------------------------------------------------------------------ DISPATCH ----

export interface CreateDispatchInput {
  actor: CommercialActor;
  clientId?: string;
  challanNumber: string;
  workOrderId: string;
  dispatchedQty: number;
  carrierName?: string;
  vehicleNumber?: string;
  driverName?: string;
  ewayBillNo?: string;
  gatePassNumber?: string;
  securityCheckedBy?: string;
  notes?: string;
}

export async function createDispatch(db: PrismaClient, input: CreateDispatchInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const dispatch = await tx.dispatchRecord.create({
        data: {
          challanNumber: input.challanNumber,
          workOrderId: input.workOrderId,
          dispatchedQty: input.dispatchedQty,
          carrierName: input.carrierName,
          vehicleNumber: input.vehicleNumber,
          driverName: input.driverName,
          ewayBillNo: input.ewayBillNo,
          gatePassNumber: input.gatePassNumber,
          securityCheckedBy: input.securityCheckedBy,
          dispatchedByName: input.actor.name ?? "Store",
          notes: input.notes,
        },
        select: { id: true, challanNumber: true },
      });
      await audit(tx, input.actor.name ?? "Store", {
        actor: input.actor.id,
        action: "DISPATCH_CREATED",
        entityType: "DispatchRecord",
        entityId: dispatch.id,
        details: JSON.stringify({ challanNumber: dispatch.challanNumber, qty: input.dispatchedQty }),
      });
      return dispatch;
    });
  const r = await withIdempotency(db, input.clientId, "commercial:dispatch:create", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

// ------------------------------------------------------------------ INVOICE ----

export interface CreateInvoiceInput {
  actor: CommercialActor;
  clientId?: string;
  invoiceNumber: string;
  dispatchRecordId?: string;
  workOrderId?: string;
  customerName: string;
  customerAddress?: string;
  customerGstin?: string;
  taxableValue: number;
  taxType?: "INTRA" | "INTER";
  taxRatePct?: number;
  cgstAmt?: number;
  sgstAmt?: number;
  igstAmt?: number;
  lines: Array<{ taxableValue: number; cgstPct: number; sgstPct: number; igstPct: number }>;
  notes?: string;
}

export async function createInvoice(db: PrismaClient, input: CreateInvoiceInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const totals = input.lines.map((l) => ({
        taxableValue: Math.round(l.taxableValue),
        cgstAmt: Math.round((Math.round(l.taxableValue) * Math.min(100, Math.max(0, l.cgstPct))) / 100),
        sgstAmt: Math.round((Math.round(l.taxableValue) * Math.min(100, Math.max(0, l.sgstPct))) / 100),
        igstAmt: Math.round((Math.round(l.taxableValue) * Math.min(100, Math.max(0, l.igstPct))) / 100),
        totalValue: 0,
      }));

      const totalTaxable = totals.reduce((s, t) => s + t.taxableValue, 0);
      const totalCgst = totals.reduce((s, t) => s + t.cgstAmt, 0);
      const totalSgst = totals.reduce((s, t) => s + t.sgstAmt, 0);
      const totalIgst = totals.reduce((s, t) => s + t.igstAmt, 0);
      const grandTotal = totalTaxable + totalCgst + totalSgst + totalIgst;

      const created = await tx.invoice.create({
        data: {
          invoiceNumber: input.invoiceNumber,
          dispatchRecordId: input.dispatchRecordId,
          workOrderId: input.workOrderId,
          customerName: input.customerName,
          customerAddress: input.customerAddress,
          customerGstin: input.customerGstin,
          taxableValue: totalTaxable,
          taxType: input.taxType ?? "INTRA",
          taxRatePct: input.taxRatePct ?? 18,
          cgstAmt: input.cgstAmt ?? totalCgst,
          sgstAmt: input.sgstAmt ?? totalSgst,
          igstAmt: input.igstAmt ?? totalIgst,
          totalValue: grandTotal,
          status: "UNPAID",
          notes: input.notes,
          lines: {
            create: totals.map((t, idx) => ({
              productName: "Item",
              qty: 1,
              unitPrice: t.taxableValue,
              lineNo: idx + 1,
              taxableValue: t.taxableValue,
              taxRatePct: input.taxRatePct ?? 18,
              cgstAmt: t.cgstAmt,
              sgstAmt: t.sgstAmt,
              igstAmt: t.igstAmt,
              totalValue: t.taxableValue + t.cgstAmt + t.sgstAmt + t.igstAmt,
            })),
          },
        },
        select: { id: true, invoiceNumber: true, status: true, totalValue: true },
      });
      await audit(tx, input.actor.name ?? "Commercial", {
        actor: input.actor.id,
        action: "INVOICE_CREATED",
        entityType: "Invoice",
        entityId: created.id,
        details: JSON.stringify({ invoiceNumber: created.invoiceNumber, total: created.totalValue }),
      });
      return created;
    });
  const r = await withIdempotency(db, input.clientId, "commercial:invoice:create", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

export interface InvoiceTransitionInput {
  actor: CommercialActor;
  clientId?: string;
  invoiceId: string;
  action: InvoiceAction;
  amount?: number;
}

export async function transitionInvoiceTx(db: PrismaClient, input: InvoiceTransitionInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { id: input.invoiceId },
        select: { id: true, invoiceNumber: true, status: true, totalValue: true, paidAmount: true },
      });
      if (!inv) throw notFound("Invoice not found");
      const currentStatus = toEngineInvoiceStatus(inv.status);
      const action = input.action.action === "APPLY_PAYMENT" && input.amount !== undefined
        ? { ...input.action, amount: input.amount }
        : input.action;
      const gate = transitionInvoice(currentStatus, Math.round(inv.totalValue), Math.round(inv.paidAmount), action);
      if (!gate.ok) throw new AppError("VALIDATION", gate.message, { details: { code: gate.code } });

      const data: Prisma.InvoiceUpdateInput = { status: fromEngineInvoiceStatus(gate.status) as DBInvoiceStatus };
      if (gate.status === "PAID" || gate.status === "PARTIAL") {
        data.paidAmount = gate.remainingBalance === 0 ? inv.totalValue : inv.totalValue - gate.remainingBalance;
      }
      const updated = await tx.invoice.update({
        where: { id: inv.id },
        data,
        select: { id: true, invoiceNumber: true, status: true, paidAmount: true, totalValue: true },
      });

      await audit(tx, input.actor.name ?? "Commercial", {
        actor: input.actor.id,
        action: `INVOICE_${gate.status}`,
        entityType: "Invoice",
        entityId: inv.id,
        details: `${inv.status} -> ${gate.status}`,
      });
      return updated;
    });
  const r = await withIdempotency(db, input.clientId, `commercial:invoice:${input.action.action}`, run);
  return r.duplicate ? { duplicate: true } : r.value;
}

// ------------------------------------------------------------------ PAYMENT ----

export interface CreatePaymentInput {
  actor: CommercialActor;
  clientId?: string;
  invoiceId: string;
  amount: number;
  method: "CASH" | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "OTHER" | "RAZORPAY";
  reference?: string;
  notes?: string;
  receivedBy: string;
}

export async function createPayment(db: PrismaClient, input: CreatePaymentInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: input.invoiceId,
          amount: input.amount,
          method: input.method,
          reference: input.reference,
          notes: input.notes,
          receivedBy: input.receivedBy,
        },
        select: { id: true, invoiceId: true, amount: true },
      });
      await audit(tx, input.actor.name ?? "Commercial", {
        actor: input.actor.id,
        action: "PAYMENT_RECEIVED",
        entityType: "Payment",
        entityId: payment.id,
        details: JSON.stringify({ invoiceId: input.invoiceId, amount: input.amount, method: input.method }),
      });
      return payment;
    });
  const r = await withIdempotency(db, input.clientId, "commercial:payment:create", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

export interface PaymentTransitionInput {
  actor: CommercialActor;
  clientId?: string;
  paymentId: string;
  action: PaymentAction;
}

export async function transitionPaymentTx(db: PrismaClient, input: PaymentTransitionInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: input.paymentId },
        select: { id: true, amount: true },
      });
      if (!payment) throw notFound("Payment not found");
      const gate = transitionPayment("PENDING", input.action);
      if (!gate.ok) throw new AppError("VALIDATION", gate.message, { details: { code: gate.code } });

      const updated = await tx.payment.findUnique({
        where: { id: payment.id },
        select: { id: true, invoiceId: true, amount: true },
      });

      await audit(tx, input.actor.name ?? "Commercial", {
        actor: input.actor.id,
        action: `PAYMENT_${gate.status}`,
        entityType: "Payment",
        entityId: payment.id,
        details: gate.status,
      });
      return { ...updated, engineStatus: gate.status };
    });
  const r = await withIdempotency(db, input.clientId, `commercial:payment:${input.action.action}`, run);
  return r.duplicate ? { duplicate: true } : r.value;
}
