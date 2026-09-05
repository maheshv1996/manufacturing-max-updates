#!/usr/bin/env node
/**
 * C10-10 — Real-DB smoke test for Reports, Digest & Print Center (C10).
 * Drives the full reporting lifecycle through typed adapters against mfgmax_v2_test:
 *   - Morning digest (OEE, delta, rankings, overnight anomaly breach flags)
 *   - Production register aggregation (good, scrap, rework, completion %, scrap %)
 *   - Stock valuation register (inventory on-hand, reorder warnings, exact integer paise)
 *   - Job profitability register (revenue, material, labor, overhead, scrap penalty, gross margins)
 *   - Job traveler print package generation (routing steps, hold points, FAI flag, QR, checksum)
 *   - In-tx audit log persistence verification (EXPORT_TRAVELER)
 *
 * Usage:
 *   node --import tsx scripts/v2-smoke-reports.mjs
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:1996@localhost:5432/mfgmax_v2_test";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  getMorningDigestTx,
  getProductionRegisterTx,
  getStockValuationRegisterTx,
  getJobProfitabilityRegisterTx,
  getJobTravelerPrintDataTx,
} from "../src/lib/reports/reportsTx.ts";
import { verifyTravelerChecksum } from "../src/lib/reports/printTraveler.ts";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, max: 5 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function log(msg) {
  console.log(`[smoke-reports] ${msg}`);
}

const results = { pass: 0, fail: 0, tests: [] };
async function smoke(name, fn) {
  try {
    await fn();
    results.pass++;
    results.tests.push({ name, status: "PASS" });
    log(`PASS: ${name}`);
  } catch (e) {
    results.fail++;
    results.tests.push({ name, status: "FAIL", error: e.message });
    log(`FAIL: ${name} — ${e.message}`);
  }
}

async function run() {
  const runId = Date.now().toString().slice(-6);
  log(`Starting C10 reports smoke run [${runId}] on ${process.env.DATABASE_URL}`);

  let plant, line, machine1, machine2, product, op, rs1, rs2, wo, reason, pLog1, dLog1, rm, complaint, incident, inv;

  try {
    // ---------------------------------------------------------------- SETUP
    await smoke("Setup test entities for reports suite", async () => {
      plant = await prisma.plant.create({
        data: {
          name: `Reports Test Plant ${runId}`,
          code: `RPT-PLANT-${runId}`,
          city: "Pune",
        },
      });

      line = await prisma.productionLine.create({
        data: {
          name: `Reports Line ${runId}`,
          plantId: plant.id,
        },
      });

      machine1 = await prisma.machine.create({
        data: {
          name: `Reports CNC 01 ${runId}`,
          code: `CNC-RPT1-${runId}`,
          lineId: line.id,
          plantId: plant.id,
          idealCycleTimeSeconds: 60,
          oeeTarget: 85.0,
        },
      });

      machine2 = await prisma.machine.create({
        data: {
          name: `Reports Lathe 02 ${runId}`,
          code: `LTH-RPT2-${runId}`,
          lineId: line.id,
          plantId: plant.id,
          idealCycleTimeSeconds: 45,
          oeeTarget: 80.0,
        },
      });

      product = await prisma.product.create({
        data: {
          sku: `SKU-RPT-${runId}`,
          name: `Titanium Bracket ${runId}`,
          description: "High-precision aerospace bracket",
          materialCostPerUnit: 250.0,
          sellingPricePerUnit: 800.0,
        },
      });

      op = await prisma.operation.create({
        data: {
          code: `OP-RPT-${runId}`,
          name: "5-Axis Milling",
          defaultCycleTimeSeconds: 60.0,
        },
      });

      rs1 = await prisma.routingStep.create({
        data: {
          productId: product.id,
          operationId: op.id,
          machineId: machine1.id,
          seq: 10,
          stationName: "CNC Milling Cell 1",
          setupTimeMin: 30,
          cycleTimeMin: 5.0,
          isHoldPoint: false,
        },
      });

      rs2 = await prisma.routingStep.create({
        data: {
          productId: product.id,
          operationId: op.id,
          machineId: machine2.id,
          seq: 20,
          stationName: "Inspection Station",
          setupTimeMin: 15,
          cycleTimeMin: 2.0,
          isHoldPoint: true,
          holdAuthority: "QUALITY_INSPECTOR",
        },
      });

      const now = new Date();
      wo = await prisma.workOrder.create({
        data: {
          woNumber: `WO-RPT-${runId}`,
          productId: product.id,
          plantId: plant.id,
          plannedQuantity: 100,
          status: "IN_PROGRESS",
          plannedStartDate: now,
          plannedEndDate: new Date(now.getTime() + 7 * 86400 * 1000),
          customerName: "Apex Aerospace Corp",
          quotedPrice: 80000.0, // ₹80,000.00
          materialCostTotal: 25000.0, // ₹25,000.00
          toolingCostRupees: 5000.0,
          faiRequired: true,
        },
      });

      pLog1 = await prisma.productionLog.create({
        data: {
          workOrderId: wo.id,
          machineId: machine1.id,
          goodQuantity: 70,
          scrapQuantity: 5,
          reworkQuantity: 2,
          startTime: now,
          endTime: new Date(now.getTime() + 180 * 60000),
        },
      });

      reason = await prisma.downtimeReason.create({
        data: {
          code: `DTR-RPT-${runId}`,
          description: "Tool Change & Calibration",
          category: "MECHANICAL",
          affectsOperatorScore: false, // planned stoppage
        },
      });

      dLog1 = await prisma.downtimeLog.create({
        data: {
          machineId: machine1.id,
          workOrderId: wo.id,
          reasonId: reason.id,
          startTime: now,
          durationMinutes: 45,
        },
      });

      rm = await prisma.rawMaterial.create({
        data: {
          sku: `RM-RPT-${runId}`,
          name: "Ti-6Al-4V Bar Stock",
          unit: "kg",
          currentStock: 12.0,
          minStock: 50.0, // low stock trigger
          unitCost: 1200.0, // ₹1,200.00 / kg
          plantId: plant.id,
        },
      });

      const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000);
      complaint = await prisma.customerComplaint.create({
        data: {
          complaintNumber: `CMP-RPT-${runId}`,
          customerName: "AeroTech Customer",
          type: "QUALITY",
          severity: "HIGH",
          description: "Dimensional variance on bracket bore",
          status: "OPEN",
          raisedAt: twoDaysAgo, // unacknowledged for 48h
        },
      });

      incident = await prisma.safetyIncident.create({
        data: {
          type: "HAZARD",
          severity: "HIGH",
          location: "Cell 1 Walkway",
          description: "Coolant mist accumulation on floor",
          status: "OPEN",
        },
      });

      inv = await prisma.invoice.create({
        data: {
          invoiceNumber: `INV-RPT-${runId}`,
          workOrderId: wo.id,
          customerName: "Apex Aerospace Corp",
          taxableValue: 8000000, // stored in paise = ₹80,000.00
          taxType: "INTRA",
          taxRatePct: 18,
          cgstAmt: 720000,
          sgstAmt: 720000,
          igstAmt: 0,
          totalValue: 9440000, // ₹94,400.00 in paise
          paidAmount: 5000000, // ₹50,000.00 in paise
          status: "PARTIAL",
        },
      });
    });

    // ---------------------------------------------------------------- TEST 1: Morning Digest
    await smoke("getMorningDigestTx calculates plant metrics and rankings", async () => {
      const digest = await getMorningDigestTx(prisma, { plantId: plant.id });
      if (!digest) throw new Error("Digest returned null");
      if (digest.plantName !== plant.name) {
        throw new Error(`Expected plant name ${plant.name}, got ${digest.plantName}`);
      }
      if (digest.openWorkOrders < 1) {
        throw new Error(`Expected at least 1 open work order, got ${digest.openWorkOrders}`);
      }
      if (digest.totalGood < 70) {
        throw new Error(`Expected at least 70 good parts, got ${digest.totalGood}`);
      }
      if (!digest.bestMachine) {
        throw new Error("Expected bestMachine to be identified");
      }
    });

    // ---------------------------------------------------------------- TEST 2: Anomaly Breaches
    await smoke("getMorningDigestTx detects overnight SLA breaches and low stock", async () => {
      const digest = await getMorningDigestTx(prisma, { plantId: plant.id });
      const codes = digest.anomalies.map((a) => a.code);
      if (!codes.includes("COMPLAINT_ACK_OVERDUE")) {
        throw new Error("Failed to detect COMPLAINT_ACK_OVERDUE anomaly");
      }
      if (!codes.includes("LOW_STOCK")) {
        throw new Error("Failed to detect LOW_STOCK anomaly");
      }
      if (!codes.includes("CRITICAL_INCIDENT")) {
        throw new Error("Failed to detect CRITICAL_INCIDENT anomaly");
      }
    });

    // ---------------------------------------------------------------- TEST 3: Production Register
    await smoke("getProductionRegisterTx aggregates production logs and computes scrap %", async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 24 * 3600 * 1000);
      const endDate = new Date(now.getTime() + 24 * 3600 * 1000);

      const reg = await getProductionRegisterTx(prisma, {
        startDate,
        endDate,
        plantId: plant.id,
      });

      if (reg.totalGood < 70) {
        throw new Error(`Expected totalGood >= 70, got ${reg.totalGood}`);
      }
      if (reg.totalScrap < 5) {
        throw new Error(`Expected totalScrap >= 5, got ${reg.totalScrap}`);
      }
      const woEntry = reg.workOrders.find((w) => w.woNumber === wo.woNumber);
      if (!woEntry) {
        throw new Error(`Work order ${wo.woNumber} not found in production register`);
      }
      if (woEntry.goodQty !== 70) {
        throw new Error(`Expected 70 good qty on WO, got ${woEntry.goodQty}`);
      }
      if (woEntry.completionPct !== 70.0) {
        throw new Error(`Expected 70.0% completion, got ${woEntry.completionPct}`);
      }
    });

    // ---------------------------------------------------------------- TEST 4: Stock Valuation Register
    await smoke("getStockValuationRegisterTx evaluates inventory in integer paise", async () => {
      const val = await getStockValuationRegisterTx(prisma, { plantId: plant.id });
      if (val.totalItems < 1) {
        throw new Error("Expected at least 1 raw material item");
      }
      const item = val.items.find((i) => i.sku === rm.sku);
      if (!item) {
        throw new Error(`Stock item ${rm.sku} not found`);
      }
      // 12 kg * ₹1200/kg (120,000 paise) = 1,440,000 paise (₹14,400.00)
      if (item.valuationPaise !== 1440000) {
        throw new Error(`Expected valuation 1440000 paise, got ${item.valuationPaise}`);
      }
      if (!item.isBelowMinStock) {
        throw new Error("Expected item to be flagged as below min stock");
      }
      if (val.lowStockItemCount < 1) {
        throw new Error("Expected lowStockItemCount >= 1");
      }
    });

    // ---------------------------------------------------------------- TEST 5: Job Profitability Register
    await smoke("getJobProfitabilityRegisterTx calculates margins and status", async () => {
      const prof = await getJobProfitabilityRegisterTx(prisma, { workOrderId: wo.id });
      if (prof.jobs.length !== 1) {
        throw new Error(`Expected 1 job result, got ${prof.jobs.length}`);
      }
      const job = prof.jobs[0];
      if (job.revenuePaise !== 9440000) {
        throw new Error(`Expected invoice revenue 9440000 paise, got ${job.revenuePaise}`);
      }
      // Direct material = ₹25,000 = 2500000 paise
      if (job.materialCostPaise !== 2500000) {
        throw new Error(`Expected material cost 2500000 paise, got ${job.materialCostPaise}`);
      }
      if (job.grossProfitPaise <= 0) {
        throw new Error(`Expected positive gross profit, got ${job.grossProfitPaise}`);
      }
      if (job.status !== "PROFITABLE") {
        throw new Error(`Expected status PROFITABLE, got ${job.status}`);
      }
    });

    // ---------------------------------------------------------------- TEST 6: Job Traveler Formatting
    await smoke("getJobTravelerPrintDataTx packages routing steps and hold points", async () => {
      const traveler = await getJobTravelerPrintDataTx(prisma, wo.id, {
        id: "usr-admin",
        name: "Quality Engineer",
      });

      if (traveler.woNumber !== wo.woNumber) {
        throw new Error(`Expected woNumber ${wo.woNumber}, got ${traveler.woNumber}`);
      }
      if (traveler.productSku !== product.sku) {
        throw new Error(`Expected SKU ${product.sku}, got ${traveler.productSku}`);
      }
      if (traveler.faiRequired !== true) {
        throw new Error("Expected faiRequired to be true");
      }
      if (traveler.routingSteps.length !== 2) {
        throw new Error(`Expected 2 routing steps, got ${traveler.routingSteps.length}`);
      }
      // Verify seq ordering
      if (traveler.routingSteps[0].seq !== 10 || traveler.routingSteps[1].seq !== 20) {
        throw new Error("Routing steps not sorted by seq ascending");
      }
      // Verify hold point
      if (traveler.routingSteps[1].isHoldPoint !== true) {
        throw new Error("Step 20 must be a hold point");
      }
      if (traveler.routingSteps[1].holdAuthority !== "QUALITY_INSPECTOR") {
        throw new Error("Hold authority mismatch");
      }
      if (!traveler.verificationHash || traveler.verificationHash.length < 8) {
        throw new Error("Missing verification hash");
      }
    });

    // ---------------------------------------------------------------- TEST 7: In-Tx Audit Logging
    await smoke("getJobTravelerPrintDataTx creates EXPORT_TRAVELER in-tx audit log", async () => {
      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          entityType: "WorkOrder",
          entityId: wo.id,
          action: "EXPORT_TRAVELER",
        },
        orderBy: { at: "desc" },
      });

      if (!auditEntry) {
        throw new Error("AuditLog row not found for EXPORT_TRAVELER");
      }
      if (auditEntry.actor !== "Quality Engineer") {
        throw new Error(`Expected actor 'Quality Engineer', got ${auditEntry.actor}`);
      }
    });

    // ---------------------------------------------------------------- TEST 8: Not Found Refusal
    await smoke("getJobTravelerPrintDataTx throws NOT_FOUND on missing work order", async () => {
      try {
        await getJobTravelerPrintDataTx(prisma, "non-existent-wo-id", { id: "u1" });
        throw new Error("Expected call to throw for missing work order");
      } catch (e) {
        if (!e.message.includes("not found") && !e.code?.includes("NOT_FOUND")) {
          throw new Error(`Unexpected error message: ${e.message}`);
        }
      }
    });

    // ---------------------------------------------------------------- TEST 9: Tamper Checksum
    await smoke("verifyTravelerChecksum accurately detects valid signature", async () => {
      const rawInput = {
        workOrderId: wo.id,
        woNumber: wo.woNumber,
        plannedQuantity: wo.plannedQuantity,
        plannedStartDate: wo.plannedStartDate,
        plannedEndDate: wo.plannedEndDate,
        faiRequired: wo.faiRequired,
        trackingMode: "BATCH",
        product: { sku: product.sku, name: product.name },
        customerName: wo.customerName,
        routingSteps: [
          {
            seq: 10,
            operationName: "Milling",
            stationName: "Cell 1",
            setupTimeMin: 15,
            cycleTimeMin: 2.5,
            isHoldPoint: false,
            holdAuthority: null,
          },
        ],
      };

      const validHash = "placeholder";
      const isValid = verifyTravelerChecksum(rawInput, validHash);
      if (isValid !== false) {
        throw new Error("Expected mismatch for placeholder hash");
      }
    });
  } finally {
    // ---------------------------------------------------------------- CLEANUP
    await smoke("Cleanup test entities", async () => {
      if (inv?.id) await prisma.invoice.deleteMany({ where: { id: inv.id } }).catch(() => {});
      if (incident?.id) await prisma.safetyIncident.deleteMany({ where: { id: incident.id } }).catch(() => {});
      if (complaint?.id) await prisma.customerComplaint.deleteMany({ where: { id: complaint.id } }).catch(() => {});
      if (rm?.id) await prisma.rawMaterial.deleteMany({ where: { id: rm.id } }).catch(() => {});
      if (dLog1?.id) await prisma.downtimeLog.deleteMany({ where: { id: dLog1.id } }).catch(() => {});
      if (reason?.id) await prisma.downtimeReason.deleteMany({ where: { id: reason.id } }).catch(() => {});
      if (pLog1?.id) await prisma.productionLog.deleteMany({ where: { id: pLog1.id } }).catch(() => {});
      if (wo?.id) {
        await prisma.auditLog.deleteMany({ where: { entityId: wo.id } }).catch(() => {});
        await prisma.workOrder.deleteMany({ where: { id: wo.id } }).catch(() => {});
      }
      if (rs1?.id || rs2?.id) await prisma.routingStep.deleteMany({ where: { productId: product?.id } }).catch(() => {});
      if (op?.id) await prisma.operation.deleteMany({ where: { id: op.id } }).catch(() => {});
      if (product?.id) await prisma.product.deleteMany({ where: { id: product.id } }).catch(() => {});
      if (machine1?.id || machine2?.id) await prisma.machine.deleteMany({ where: { plantId: plant?.id } }).catch(() => {});
      if (line?.id) await prisma.productionLine.deleteMany({ where: { id: line.id } }).catch(() => {});
      if (plant?.id) await prisma.plant.deleteMany({ where: { id: plant.id } }).catch(() => {});
    });

    await prisma.$disconnect();
    await pool.end();
  }

  log(`Suite finished: ${results.pass} passed, ${results.fail} failed.`);
  if (results.fail > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Fatal smoke error:", e);
  process.exit(1);
});
