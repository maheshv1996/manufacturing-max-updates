/**
 * C10-3 — Physical Shopfloor Job Traveler & Routing Card Engine (DEPTH_03 F1 / W2 / W6).
 * High-fidelity physical print format for work orders, AS9102 FAI badge (G-1),
 * Hold Points (G-2), material traceability, and tamper-evident SHA-256 verification token.
 * DB-free, typed Result envelope.
 */

import { createHash } from "node:crypto";
import { ok, type Result } from "../core/result";
import { type AppError } from "../core/errors";

export interface TravelerRoutingStep {
  seq: number;
  operationName: string;
  stationName: string;
  setupTimeMin: number;
  cycleTimeMin: number;
  isHoldPoint: boolean;
  holdAuthority: string | null;
}

export interface TravelerDimension {
  balloonNo: number;
  parameter: string;
  nominal: number;
  usl: number;
  lsl: number;
  unit: string;
}

export interface JobTravelerRawInput {
  workOrderId: string;
  woNumber: string;
  plannedQuantity: number;
  plannedStartDate: Date;
  plannedEndDate: Date;
  faiRequired: boolean;
  trackingMode: "BATCH" | "SERIAL";
  product: {
    sku: string;
    name: string;
    description?: string | null;
  };
  customerName?: string | null;
  routingSteps: TravelerRoutingStep[];
  materialHeatNo?: string | null;
  millCertAttached?: boolean;
  inspectionDimensions?: TravelerDimension[];
}

export interface JobTravelerDto {
  workOrderId: string;
  woNumber: string;
  plannedQuantity: number;
  plannedStartDate: string;
  plannedEndDate: string;
  faiRequired: boolean;
  trackingMode: "BATCH" | "SERIAL";
  productSku: string;
  productName: string;
  productDescription: string;
  customerName: string;
  routingSteps: TravelerRoutingStep[];
  materialHeatNo: string;
  millCertAttached: boolean;
  inspectionDimensions: TravelerDimension[];
  qrPayload: string;
  verificationHash: string;
}

/**
 * Generates a deterministic SHA-256 tamper-evident checksum for physical job traveler verification.
 */
export function generateTravelerChecksum(input: JobTravelerRawInput): string {
  const sortedSteps = [...input.routingSteps].sort((a, b) => a.seq - b.seq);
  const coreSignature = {
    woNumber: input.woNumber.trim(),
    productSku: input.product.sku.trim(),
    plannedQuantity: input.plannedQuantity,
    faiRequired: input.faiRequired,
    trackingMode: input.trackingMode,
    customerName: input.customerName?.trim() || "",
    materialHeatNo: input.materialHeatNo?.trim() || "",
    steps: sortedSteps.map((s) => ({
      seq: s.seq,
      op: s.operationName,
      hold: s.isHoldPoint,
      auth: s.holdAuthority || "",
    })),
  };

  return createHash("sha256").update(JSON.stringify(coreSignature)).digest("hex").slice(0, 16);
}

/**
 * Verifies whether a printed/scanned traveler's data matches its verification hash.
 */
export function verifyTravelerChecksum(input: JobTravelerRawInput, expectedHash: string): boolean {
  const actualHash = generateTravelerChecksum(input);
  return actualHash === expectedHash;
}

/**
 * Formats raw work order data into the standardized physical traveler print data structure.
 */
export function formatJobTraveler(input: JobTravelerRawInput): Result<JobTravelerDto, AppError> {
  const sortedSteps = [...input.routingSteps].sort((a, b) => a.seq - b.seq);
  const verificationHash = generateTravelerChecksum(input);
  const qrPayload = `MFGMAX-WO:${input.woNumber}:${input.product.sku}:QTY${input.plannedQuantity}:SIG${verificationHash}`;

  const dto: JobTravelerDto = {
    workOrderId: input.workOrderId,
    woNumber: input.woNumber,
    plannedQuantity: input.plannedQuantity,
    plannedStartDate: input.plannedStartDate.toISOString(),
    plannedEndDate: input.plannedEndDate.toISOString(),
    faiRequired: input.faiRequired,
    trackingMode: input.trackingMode,
    productSku: input.product.sku,
    productName: input.product.name,
    productDescription: input.product.description || "",
    customerName: input.customerName || "Standard Inventory Stock",
    routingSteps: sortedSteps,
    materialHeatNo: input.materialHeatNo || "PENDING_HEAT_ALLOCATION",
    millCertAttached: Boolean(input.millCertAttached),
    inspectionDimensions: input.inspectionDimensions || [],
    qrPayload,
    verificationHash,
  };

  return ok(dto);
}
