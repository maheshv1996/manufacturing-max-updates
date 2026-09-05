import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildProductionRegister,
  buildStockValuationRegister,
  calculateJobProfitability,
  buildSupplierScorecards,
  buildSalesGstRegister,
  type ProductionLogRowInput,
  type StockItemInput,
  type JobCostingInput,
  type SupplierPoRecord,
  type InvoiceRegisterInput,
} from "../src/lib/reports/registers";

test("buildProductionRegister aggregates quantities and computes scrap and completion rates", () => {
  const logs: ProductionLogRowInput[] = [
    {
      workOrderId: "wo-1",
      woNumber: "WO-2026-001",
      productSku: "PART-A",
      productName: "Turbine Blade",
      plannedQty: 100,
      machineCode: "CNC-01",
      goodQty: 40,
      scrapQty: 5,
      reworkQty: 2,
      runMinutes: 240,
    },
    {
      workOrderId: "wo-1",
      woNumber: "WO-2026-001",
      productSku: "PART-A",
      productName: "Turbine Blade",
      plannedQty: 100,
      machineCode: "CNC-01",
      goodQty: 50,
      scrapQty: 5,
      reworkQty: 0,
      runMinutes: 260,
    },
    {
      workOrderId: "wo-2",
      woNumber: "WO-2026-002",
      productSku: "PART-B",
      productName: "Flange Mount",
      plannedQty: 50,
      machineCode: "LTH-01",
      goodQty: 50,
      scrapQty: 0,
      reworkQty: 0,
      runMinutes: 150,
    },
  ];

  const reg = buildProductionRegister(logs);

  assert.equal(reg.totalGood, 140);
  assert.equal(reg.totalScrap, 10);
  assert.equal(reg.totalRework, 2);
  assert.equal(reg.workOrders.length, 2);

  const wo1 = reg.workOrders.find((w) => w.woNumber === "WO-2026-001");
  assert.ok(wo1);
  assert.equal(wo1?.goodQty, 90);
  assert.equal(wo1?.scrapQty, 10);
  assert.equal(wo1?.completionPct, 90.0); // 90 / 100
  assert.equal(wo1?.scrapPct, 10.0); // 10 scrap / (90 good + 10 scrap) = 10%
});

test("buildStockValuationRegister computes exact integer paise inventory valuation", () => {
  const stockItems: StockItemInput[] = [
    {
      id: "rm-1",
      sku: "RAW-ALU-01",
      name: "Aluminium Rod 50mm",
      unit: "kg",
      currentStock: 100.5,
      minStock: 50,
      unitCostPaise: 45000, // ₹450.00 / kg in paise
      materialClass: "A",
    },
    {
      id: "rm-2",
      sku: "FASTENER-M6",
      name: "M6 Hex Bolt",
      unit: "pcs",
      currentStock: 20,
      minStock: 100, // below minimum
      unitCostPaise: 250, // ₹2.50 / piece in paise
      materialClass: "C",
    },
  ];

  const valuation = buildStockValuationRegister(stockItems);

  assert.equal(valuation.items.length, 2);
  // Item 1: 100.5 * 45000 = 4522500 paise (₹45,225.00)
  assert.equal(valuation.items[0].valuationPaise, 4522500);
  assert.equal(valuation.items[0].isBelowMinStock, false);

  // Item 2: 20 * 250 = 5000 paise (₹50.00)
  assert.equal(valuation.items[1].valuationPaise, 5000);
  assert.equal(valuation.items[1].isBelowMinStock, true);

  assert.equal(valuation.totalValuationPaise, 4527500);
  assert.equal(valuation.lowStockItemCount, 1);
});

test("calculateJobProfitability calculates accurate cost breakdowns, margins, and status", () => {
  const job: JobCostingInput = {
    workOrderId: "wo-101",
    woNumber: "WO-2026-101",
    customerName: "AeroDynamics Ltd",
    revenuePaise: 10000000, // ₹1,00,000.00
    materialCostPaise: 4000000, // ₹40,000.00
    laborCostPaise: 2000000, // ₹20,000.00
    overheadCostPaise: 1000000, // ₹10,000.00
    scrapCostPaise: 500000, // ₹5,000.00
  };

  const result = calculateJobProfitability(job);

  assert.equal(result.totalCostPaise, 7500000); // 40k + 20k + 10k + 5k = 75k
  assert.equal(result.grossProfitPaise, 2500000); // 100k - 75k = 25k
  assert.equal(result.marginPct, 25.0); // 25k / 100k = 25%
  assert.equal(result.status, "PROFITABLE");

  // Unprofitable job test
  const lossJob: JobCostingInput = {
    workOrderId: "wo-102",
    woNumber: "WO-2026-102",
    customerName: "Loss Corp",
    revenuePaise: 5000000, // 50k
    materialCostPaise: 4000000,
    laborCostPaise: 1500000,
    overheadCostPaise: 500000,
    scrapCostPaise: 200000,
  };
  const lossResult = calculateJobProfitability(lossJob);
  assert.equal(lossResult.grossProfitPaise, -1200000); // 50k - 62k = -12k
  assert.equal(lossResult.marginPct, -24.0);
  assert.equal(lossResult.status, "UNPROFITABLE");
});

test("buildSupplierScorecards calculates on-time delivery (OTD) and quality rates", () => {
  const pos: SupplierPoRecord[] = [
    {
      supplierId: "sup-1",
      supplierName: "Apex Metals",
      poNumber: "PO-001",
      orderedQty: 100,
      receivedQty: 100,
      expectedDate: new Date("2026-09-01"),
      receivedAt: new Date("2026-08-31"), // on-time
      rejectedQty: 2,
    },
    {
      supplierId: "sup-1",
      supplierName: "Apex Metals",
      poNumber: "PO-002",
      orderedQty: 100,
      receivedQty: 100,
      expectedDate: new Date("2026-09-01"),
      receivedAt: new Date("2026-09-03"), // late
      rejectedQty: 0,
    },
  ];

  const scorecards = buildSupplierScorecards(pos);
  assert.equal(scorecards.length, 1);
  const sc = scorecards[0];
  assert.equal(sc.supplierName, "Apex Metals");
  assert.equal(sc.totalOrders, 2);
  assert.equal(sc.onTimeOrders, 1);
  assert.equal(sc.otdPct, 50.0); // 1/2
  assert.equal(sc.qualityAcceptancePct, 99.0); // (200 - 2) / 200 = 99%
});

test("buildSalesGstRegister calculates GST and outstanding balances", () => {
  const invoices: InvoiceRegisterInput[] = [
    {
      invoiceNumber: "INV-2026-001",
      customerName: "AeroTech",
      customerGstin: "27AAAAA0000A1Z5",
      invoiceDate: new Date("2026-09-01"),
      taxableValuePaise: 1000000, // ₹10,000.00
      taxType: "INTRA",
      taxRatePct: 18,
      cgstPaise: 90000, // 9%
      sgstPaise: 90000, // 9%
      igstPaise: 0,
      totalValuePaise: 1180000, // ₹11,800.00
      paidAmountPaise: 500000, // ₹5,000.00 paid
      status: "PARTIAL",
    },
    {
      invoiceNumber: "INV-2026-002",
      customerName: "InterState Dynamics",
      customerGstin: "29BBBBB1111B1Z2",
      invoiceDate: new Date("2026-09-02"),
      taxableValuePaise: 2000000, // ₹20,000.00
      taxType: "INTER",
      taxRatePct: 18,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 360000, // 18% IGST
      totalValuePaise: 2360000, // ₹23,600.00
      paidAmountPaise: 2360000, // full paid
      status: "PAID",
    },
  ];

  const reg = buildSalesGstRegister(invoices);
  assert.equal(reg.totalTaxablePaise, 3000000);
  assert.equal(reg.totalCgstPaise, 90000);
  assert.equal(reg.totalSgstPaise, 90000);
  assert.equal(reg.totalIgstPaise, 360000);
  assert.equal(reg.totalValuePaise, 3540000);
  assert.equal(reg.totalPaidPaise, 2860000);
  assert.equal(reg.totalBalanceDuePaise, 680000); // 3540000 - 2860000
});
