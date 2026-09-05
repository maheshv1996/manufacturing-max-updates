/**
 * C5-5 — Typed supply-chain transaction adapter (DEPTH_04 W3/W4/W12).
 * Every mutation runs the pure engine first and only then writes, inside one
 * `$transaction`, guarded by the C1 idempotency core when a clientId is
 * present, with in-tx audit rows. Zero type casts; the engine is the only
 * source of truth for gates.
 *
 * Design notes:
 * - GRN numbers come from the transactional sequence allocator (v1 parity).
 * - W3 cert gate: when `requireMillCerts` is on, every received unit needs a
 *   linked MaterialCert. MaterialCert.inventoryTransactionId is @unique, so a
 *   certed receipt writes one IN row (qty 1) per cert, each carrying its cert;
 *   an uncerted receipt writes a single IN row for the whole qty.
 * - Subcontract FAIL signoff flags the NCR routing here; the actual NCR
 *   document is created by the quality flow (C3), noted as a boundary.
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import { AppError, notFound, validation } from "../core/errors";
import { runIdempotent } from "../core/integrityDb";
import { buildAuditEvent, type AuditEventInput } from "../core/audit";
import { nextSequenceTx } from "../sequence";
import { parseSettings } from "../core/settings";
import { advancePoApproval, type PoApprovalAction, type PoStatus } from "./po";
import { applyReceipt, stockAfterTx } from "./receipt";
import { varianceCheck, approveAdjustment } from "./inventory";
import { dispatchChallan, receiveBack, signOff, type ChallanStatus } from "./subcontract";

type Tx = Prisma.TransactionClient;

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

export interface SupplyActor {
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

/** Engines return { ok: false, code } — map to a typed API error. */
function engineError(gate: { ok: false; code: string }): AppError {
  return new AppError("VALIDATION", `Supply gate blocked: ${gate.code}`, { details: { code: gate.code } });
}

async function loadSettings(db: PrismaClient): Promise<{ requireMillCerts: boolean; countTolerance: number }> {
  const rows = await db.setting.findMany();
  const s = parseSettings(new Map(rows.map((r) => [r.key, r.value])));
  return { requireMillCerts: s.requireMillCerts, countTolerance: s.countTolerance };
}

// ------------------------------------------------------------ PO ----

export interface CreatePoInput {
  actor: SupplyActor;
  clientId?: string;
  supplierId: string;
  rawMaterialId: string;
  qty: number;
  unitCost: number;
  expectedDate?: string;
  /** Amount exceeds the manager/owner approval threshold → ladder starts pending. */
  overThreshold?: "MANAGER" | "OWNER";
}

export async function createPoTx(db: PrismaClient, input: CreatePoInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const qty = Number(input.qty);
      const unitCost = Number(input.unitCost);
      if (!Number.isFinite(qty) || qty <= 0) throw validation("qty must be a positive number");
      if (!Number.isFinite(unitCost) || unitCost < 0) throw validation("unitCost must be a non-negative number");

      let approvalStatus: "APPROVED" | "PENDING_MANAGER" | "PENDING_OWNER" | "REJECTED" = "APPROVED";
      let approvalLevel: string | null = null;
      if (input.overThreshold) {
        const gate = advancePoApproval(approvalStatus, { action: "ESCALATE", tier: input.overThreshold });
        if (!gate.ok) throw engineError(gate);
        approvalStatus = gate.approvalStatus;
        approvalLevel = input.overThreshold;
      }

      const poNumber = await nextSequenceTx(tx, "PO", 4);
      const created = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: input.supplierId,
          rawMaterialId: input.rawMaterialId,
          qty,
          unitCost,
          status: "ORDERED",
          expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
          createdBy: input.actor.name ?? "Purchasing",
          approvalStatus,
          approvalLevel,
          lines: {
            create: { rawMaterialId: input.rawMaterialId, lineNo: 1, qty, unitCost },
          },
        },
        select: { id: true, poNumber: true, status: true, approvalStatus: true },
      });
      await audit(tx, input.actor.name ?? "Purchasing", {
        actor: input.actor.id,
        action: "PO_CREATED",
        entityType: "PurchaseOrder",
        entityId: created.id,
        details: `${poNumber}: ${qty} x ${unitCost} (approval ${approvalStatus})`,
      });
      return created;
    });
  const r = await withIdempotency(db, input.clientId, "supply:po:create", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

export interface PoApprovalInput {
  actor: SupplyActor;
  clientId?: string;
  poId: string;
  action: PoApprovalAction;
}

export async function advancePoApprovalTx(db: PrismaClient, input: PoApprovalInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: input.poId },
        select: { id: true, poNumber: true, approvalStatus: true },
      });
      if (!po) throw notFound("Purchase order not found");
      const gate = advancePoApproval(
        castStatus<"APPROVED" | "PENDING_MANAGER" | "PENDING_OWNER" | "REJECTED">(po.approvalStatus, [
          "APPROVED",
          "PENDING_MANAGER",
          "PENDING_OWNER",
          "REJECTED",
        ]),
        input.action,
      );
      if (!gate.ok) throw engineError(gate);

      const data: Prisma.PurchaseOrderUpdateInput = { approvalStatus: gate.approvalStatus };
      if (input.action.action === "ESCALATE") data.approvalLevel = input.action.tier;
      if (input.action.action === "APPROVE") {
        if (input.action.tier === "MANAGER") {
          data.managerApprovedBy = input.actor.name ?? input.actor.id;
          data.managerApprovedAt = new Date();
          data.approvalLevel = input.action.ownerStillRequired ? "OWNER" : null;
        } else {
          data.ownerApprovedBy = input.actor.name ?? input.actor.id;
          data.ownerApprovedAt = new Date();
          data.approvalLevel = null;
        }
      }
      if (input.action.action === "REJECT") {
        data.rejectedBy = input.actor.name ?? input.actor.id;
        data.rejectedAt = new Date();
        data.rejectionReason = input.action.reason;
      }
      const updated = await tx.purchaseOrder.update({
        where: { id: po.id },
        data,
        select: { id: true, poNumber: true, approvalStatus: true },
      });
      await audit(tx, input.actor.name ?? "Purchasing", {
        actor: input.actor.id,
        action: `PO_APPROVAL_${input.action.action}`,
        entityType: "PurchaseOrder",
        entityId: po.id,
        details: `${po.poNumber}: ${po.approvalStatus} -> ${gate.approvalStatus}`,
      });
      return updated;
    });
  const r = await withIdempotency(db, input.clientId, `supply:po:${input.action.action}`, run);
  return r.duplicate ? { duplicate: true } : r.value;
}

// ------------------------------------------------------- Receipt ----

export interface CertInput {
  heatNumber: string;
  certNumber?: string;
  specGrade?: string;
  certType?: "MILL_CERT" | "COC" | "TEST_REPORT";
}

export interface ReceiveGrnInput {
  actor: SupplyActor;
  clientId?: string;
  poId: string;
  qty: number;
  batchNo?: string;
  notes?: string;
  /** Uploaded with the receipt — counts against the W3 cert gate. */
  certs?: CertInput[];
}

export async function receiveGrnTx(db: PrismaClient, input: ReceiveGrnInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: input.poId },
        select: {
          id: true,
          poNumber: true,
          supplierId: true,
          rawMaterialId: true,
          qty: true,
          unitCost: true,
          status: true,
          receivedQty: true,
          lines: { select: { id: true, receivedQty: true }, orderBy: { lineNo: "asc" } },
        },
      });
      if (!po) throw notFound("Purchase order not found");

      // Synthesize the line for legacy single-line POs (v1 parity).
      let line = po.lines[0];
      if (!line) {
        line = await tx.purchaseOrderLine.create({
          data: { poId: po.id, rawMaterialId: po.rawMaterialId, lineNo: 1, qty: po.qty, unitCost: po.unitCost },
          select: { id: true, receivedQty: true },
        });
      }

      const settings = await loadSettings(db);
      const gate = applyReceipt({
        poStatus: castStatus<PoStatus>(po.status, ["ORDERED", "PARTIAL", "RECEIVED", "CANCELLED"]),
        receivedQty: Number(po.receivedQty),
        addQty: Number(input.qty),
        poQty: Number(po.qty),
        tolerancePct: settings.countTolerance,
        certsRequired: settings.requireMillCerts,
        certsLinked: input.certs?.length ?? 0,
      });
      if (!gate.ok) throw engineError(gate);

      const qty = Number(input.qty);
      if (!Number.isFinite(qty) || qty <= 0) throw validation("qty must be a positive number");
      const grnNumber = await nextSequenceTx(tx, "GRN", 4);
      const userName = input.actor.name ?? "Storekeeper";

      const grn = await tx.goodsReceiptNote.create({
        data: {
          grnNumber,
          poId: po.id,
          poLineId: line.id,
          supplierId: po.supplierId,
          rawMaterialId: po.rawMaterialId,
          receivedQty: qty,
          receivedBy: userName,
          batchNo: input.batchNo ?? null,
          notes: input.notes ?? null,
        },
        select: { id: true, grnNumber: true, receivedQty: true },
      });

      await tx.rawMaterial.update({
        where: { id: po.rawMaterialId },
        data: { currentStock: { increment: qty } },
      });

      // W3: certed receipts write one IN row per cert (each carries its cert —
      // MaterialCert.inventoryTransactionId is @unique); uncerted: one IN row.
      const certs = input.certs ?? [];
      if (certs.length > 0) {
        for (const c of certs) {
          const inv = await tx.inventoryTransaction.create({
            data: {
              rawMaterialId: po.rawMaterialId,
              type: "IN",
              qty: 1,
              unitCost: po.unitCost,
              batchNo: input.batchNo ?? null,
              reference: grnNumber,
              actorName: userName,
            },
            select: { id: true },
          });
          await tx.materialCert.create({
            data: {
              inventoryTransactionId: inv.id,
              rawMaterialId: po.rawMaterialId,
              supplierId: po.supplierId,
              heatNumber: c.heatNumber,
              certNumber: c.certNumber ?? null,
              specGrade: c.specGrade ?? null,
              certType: c.certType ?? "MILL_CERT",
              uploadedBy: userName,
            },
          });
        }
      } else {
        await tx.inventoryTransaction.create({
          data: {
            rawMaterialId: po.rawMaterialId,
            type: "IN",
            qty,
            unitCost: po.unitCost,
            batchNo: input.batchNo ?? null,
            reference: grnNumber,
            actorName: userName,
          },
        });
      }

      const newLineReceived = Number(line.receivedQty) + qty;
      await tx.purchaseOrderLine.update({ where: { id: line.id }, data: { receivedQty: newLineReceived } });
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { receivedQty: gate.newReceived, status: gate.nextStatus, receivedAt: new Date() },
      });

      await audit(tx, userName, {
        actor: input.actor.id,
        action: "GRN_CREATED",
        entityType: "GoodsReceiptNote",
        entityId: grn.id,
        details: `${grnNumber}: received ${qty} against ${po.poNumber} -> ${gate.nextStatus}`,
      });
      return { grn, poStatus: gate.nextStatus, newReceived: gate.newReceived };
    });
  const r = await withIdempotency(db, input.clientId, "supply:grn:receive", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

// -------------------------------------------------- Cycle count ----

export interface CreateCycleCountInput {
  actor: SupplyActor;
  clientId?: string;
  name: string;
  abcClass: "A" | "B" | "C";
  lines: Array<{ rawMaterialId: string; systemQty: number }>;
}

export async function createCycleCountSessionTx(db: PrismaClient, input: CreateCycleCountInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      if (input.lines.length === 0) throw validation("at least one count line is required");
      const sessionNumber = await nextSequenceTx(tx, "CC", 4);
      const created = await tx.cycleCountSession.create({
        data: {
          sessionNumber,
          name: input.name,
          abcClass: input.abcClass,
          status: "OPEN",
          startedBy: input.actor.name ?? "Stores",
          lines: {
            create: input.lines.map((l) => ({ rawMaterialId: l.rawMaterialId, systemQty: Number(l.systemQty) })),
          },
        },
        select: { id: true, sessionNumber: true, status: true },
      });
      await audit(tx, input.actor.name ?? "Stores", {
        actor: input.actor.id,
        action: "CYCLE_COUNT_STARTED",
        entityType: "CycleCountSession",
        entityId: created.id,
        details: `${sessionNumber}: ${input.lines.length} lines (${input.abcClass})`,
      });
      return created;
    });
  const r = await withIdempotency(db, input.clientId, "supply:cyclecount:create", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

export interface CountLineInput {
  actor: SupplyActor;
  clientId?: string;
  lineId: string;
  countedQty: number;
}

export async function countCycleLineTx(db: PrismaClient, input: CountLineInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const line = await tx.cycleCountLine.findUnique({
        where: { id: input.lineId },
        select: { id: true, rawMaterialId: true, systemQty: true, status: true, sessionId: true },
      });
      if (!line) throw notFound("Cycle count line not found");
      const settings = await loadSettings(db);
      const counted = Number(input.countedQty);
      if (!Number.isFinite(counted) || counted < 0) throw validation("countedQty must be a non-negative number");
      const v = varianceCheck(Number(line.systemQty), counted, settings.countTolerance);
      const updated = await tx.cycleCountLine.update({
        where: { id: line.id },
        data: {
          countedQty: counted,
          variance: v.variance,
          variancePct: Number(line.systemQty) > 0 ? (v.variance / Number(line.systemQty)) * 100 : 0,
          countedBy: input.actor.name ?? "Stores",
          countedAt: new Date(),
          status: v.within ? "OK" : "COUNTED",
        },
        select: { id: true, status: true, variance: true },
      });
      await audit(tx, input.actor.name ?? "Stores", {
        actor: input.actor.id,
        action: "CYCLE_COUNT_LINE_COUNTED",
        entityType: "CycleCountLine",
        entityId: line.id,
        details: `system ${line.systemQty} -> counted ${counted} (variance ${v.variance})`,
      });
      return { ...updated, varianceWithinTolerance: v.within };
    });
  const r = await withIdempotency(db, input.clientId, "supply:cyclecount:count", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

export interface ApproveAdjustmentInput {
  actor: SupplyActor;
  clientId?: string;
  lineId: string;
  reason: string;
}

export async function approveCycleAdjustmentTx(db: PrismaClient, input: ApproveAdjustmentInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const line = await tx.cycleCountLine.findUnique({
        where: { id: input.lineId },
        select: {
          id: true,
          rawMaterialId: true,
          systemQty: true,
          countedQty: true,
          status: true,
          sessionId: true,
        },
      });
      if (!line) throw notFound("Cycle count line not found");
      if (line.countedQty === null) throw validation("line has not been counted yet");

      const settings = await loadSettings(db);
      const v = varianceCheck(Number(line.systemQty), Number(line.countedQty), settings.countTolerance);
      const gate = approveAdjustment(v, { authority: true, reason: input.reason });
      if (!gate.ok) throw engineError(gate);

      const delta = Number(line.countedQty) - Number(line.systemQty);
      const material = await tx.rawMaterial.findUnique({
        where: { id: line.rawMaterialId },
        select: { id: true, currentStock: true },
      });
      if (!material) throw notFound("Raw material not found");

      if (delta !== 0) {
        const stock = stockAfterTx(Number(material.currentStock), { type: "ADJUST", qty: delta, reason: input.reason });
        if (!stock.ok) throw engineError(stock);
        await tx.rawMaterial.update({
          where: { id: line.rawMaterialId },
          data: { currentStock: stock.balance },
        });
        await tx.inventoryTransaction.create({
          data: {
            rawMaterialId: line.rawMaterialId,
            type: "ADJUST",
            qty: delta,
            batchNo: null,
            reference: `CC-${line.sessionId.slice(0, 8)}`,
            actorName: input.actor.name ?? "Stores",
            adjustmentHistory: { reason: input.reason } as object,
          },
        });
      }

      await tx.cycleCountLine.update({
        where: { id: line.id },
        data: { status: "VAR_APPROVED", note: input.reason },
      });
      await tx.cycleCountSession.update({
        where: { id: line.sessionId },
        data: { status: "ADJUSTED", approvedBy: input.actor.name ?? input.actor.id, approvedAt: new Date(), approvalNote: input.reason },
      });

      await audit(tx, input.actor.name ?? "Stores", {
        actor: input.actor.id,
        action: "CYCLE_COUNT_ADJUSTED",
        entityType: "CycleCountLine",
        entityId: line.id,
        details: `delta ${delta}: ${input.reason}`,
      });
      return { lineId: line.id, delta, balance: delta === 0 ? Number(material.currentStock) : undefined };
    });
  const r = await withIdempotency(db, input.clientId, "supply:cyclecount:adjust", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

// -------------------------------------------------- Subcontract ----

export const PROCESS_TYPES = ["HEAT_TREATMENT", "ANODIZING", "PLATING", "NDT", "BLACKODIZING"] as const;
export type ProcessType = (typeof PROCESS_TYPES)[number];

export interface DispatchChallanInput {
  actor: SupplyActor;
  clientId?: string;
  workOrderId: string;
  vendorName: string;
  processType: ProcessType;
  dispatchedQty: number;
  expectedReturn?: string;
  vehicleNumber?: string;
  accredited: boolean;
  contractRequiresAccreditation: boolean;
}

export async function dispatchChallanTx(db: PrismaClient, input: DispatchChallanInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const gate = dispatchChallan({ accredited: input.accredited, contractRequiresAccreditation: input.contractRequiresAccreditation });
      if (!gate.ok) throw engineError(gate);
      const qty = Number(input.dispatchedQty);
      if (!Number.isInteger(qty) || qty <= 0) throw validation("dispatchedQty must be a positive integer");

      const challanNumber = await nextSequenceTx(tx, "CHL", 4);
      const created = await tx.subcontractChallan.create({
        data: {
          challanNumber,
          workOrderId: input.workOrderId,
          vendorName: input.vendorName,
          processType: input.processType,
          dispatchedQty: qty,
          expectedReturn: input.expectedReturn ? new Date(input.expectedReturn) : null,
          vehicleNumber: input.vehicleNumber ?? null,
          status: "DISPATCHED",
        },
        select: { id: true, challanNumber: true, status: true },
      });
      await audit(tx, input.actor.name ?? "Purchasing", {
        actor: input.actor.id,
        action: "SUBCONTRACT_DISPATCHED",
        entityType: "SubcontractChallan",
        entityId: created.id,
        details: `${challanNumber}: ${qty} pcs ${input.processType} -> ${input.vendorName}`,
      });
      return created;
    });
  const r = await withIdempotency(db, input.clientId, "supply:subcontract:dispatch", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

/** Schema -> engine challan status mapping (v2 names vs schema names). */
function toEngineChallanStatus(s: string): ChallanStatus {
  switch (s) {
    case "DISPATCHED":
      return "DISPATCHED";
    case "RECEIVED":
      return "RECEIVED_BACK";
    case "QC_PASSED":
      return "QC_PASSED";
    case "QC_FAILED":
      return "QC_FAILED";
    default:
      throw validation(`Unknown challan status ${s}`);
  }
}

export interface ReceiveBackChallanInput {
  actor: SupplyActor;
  clientId?: string;
  challanId: string;
  receivedQty: number;
  certsPresent: number;
  specialProcessCertsRequired: number;
}

export async function receiveBackChallanTx(db: PrismaClient, input: ReceiveBackChallanInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const challan = await tx.subcontractChallan.findUnique({
        where: { id: input.challanId },
        select: { id: true, challanNumber: true, status: true },
      });
      if (!challan) throw notFound("Subcontract challan not found");
      const gate = receiveBack({
        status: toEngineChallanStatus(challan.status),
        certsPresent: input.certsPresent,
        specialProcessCertsRequired: input.specialProcessCertsRequired,
      });
      if (!gate.ok) throw engineError(gate);
      const qty = Number(input.receivedQty);
      if (!Number.isInteger(qty) || qty < 0) throw validation("receivedQty must be a non-negative integer");

      const updated = await tx.subcontractChallan.update({
        where: { id: challan.id },
        data: { status: "RECEIVED", receivedQty: qty, receivedAt: new Date() },
        select: { id: true, challanNumber: true, status: true },
      });
      await audit(tx, input.actor.name ?? "Purchasing", {
        actor: input.actor.id,
        action: "SUBCONTRACT_RECEIVED_BACK",
        entityType: "SubcontractChallan",
        entityId: challan.id,
        details: `${challan.challanNumber}: received ${qty} pcs`,
      });
      return updated;
    });
  const r = await withIdempotency(db, input.clientId, "supply:subcontract:receive", run);
  return r.duplicate ? { duplicate: true } : r.value;
}

export interface SignOffChallanInput {
  actor: SupplyActor;
  clientId?: string;
  challanId: string;
  result: "PASS" | "FAIL";
}

export async function signOffChallanTx(db: PrismaClient, input: SignOffChallanInput) {
  const run = async () =>
    db.$transaction(async (tx) => {
      const challan = await tx.subcontractChallan.findUnique({
        where: { id: input.challanId },
        select: { id: true, challanNumber: true, status: true },
      });
      if (!challan) throw notFound("Subcontract challan not found");
      const gate = signOff({ status: toEngineChallanStatus(challan.status), result: input.result });
      if (!gate.ok) throw engineError(gate);

      const updated = await tx.subcontractChallan.update({
        where: { id: challan.id },
        data: { status: gate.status },
        select: { id: true, challanNumber: true, status: true },
      });
      await audit(tx, input.actor.name ?? "QC", {
        actor: input.actor.id,
        action: gate.routesToNcr ? "SUBCONTRACT_QC_FAILED" : "SUBCONTRACT_QC_PASSED",
        entityType: "SubcontractChallan",
        entityId: challan.id,
        details: `${challan.challanNumber}: QC ${input.result}`,
      });
      return { ...updated, routesToNcr: gate.routesToNcr };
    });
  const r = await withIdempotency(db, input.clientId, "supply:subcontract:signoff", run);
  return r.duplicate ? { duplicate: true } : r.value;
}