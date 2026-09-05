/**
 * C10-2 — Pure Registers Engine (DEPTH_03 F1 / F12 / DEPTH_04 W1 / W12).
 * Pure domain aggregators for Production, Stock Valuation, Job Profitability,
 * Supplier Scorecards, and Sales/GST Registers.
 * Strictly integer paise for money, DB-free, typed Result envelope.
 */

// ------------------------------------------------------------------ 1. Production Register

export interface ProductionLogRowInput {
  workOrderId: string;
  woNumber: string;
  productSku: string;
  productName: string;
  plannedQty: number;
  machineCode: string;
  goodQty: number;
  scrapQty: number;
  reworkQty: number;
  runMinutes: number;
}

export interface WorkOrderProductionSummary {
  workOrderId: string;
  woNumber: string;
  productSku: string;
  productName: string;
  plannedQty: number;
  goodQty: number;
  scrapQty: number;
  reworkQty: number;
  runMinutes: number;
  completionPct: number;
  scrapPct: number;
}

export interface ProductionRegisterDto {
  workOrders: WorkOrderProductionSummary[];
  totalGood: number;
  totalScrap: number;
  totalRework: number;
  totalRunMinutes: number;
  overallScrapPct: number;
}

export function buildProductionRegister(logs: ProductionLogRowInput[]): ProductionRegisterDto {
  const map = new Map<string, WorkOrderProductionSummary>();

  for (const log of logs) {
    let summary = map.get(log.workOrderId);
    if (!summary) {
      summary = {
        workOrderId: log.workOrderId,
        woNumber: log.woNumber,
        productSku: log.productSku,
        productName: log.productName,
        plannedQty: log.plannedQty,
        goodQty: 0,
        scrapQty: 0,
        reworkQty: 0,
        runMinutes: 0,
        completionPct: 0,
        scrapPct: 0,
      };
      map.set(log.workOrderId, summary);
    }

    summary.goodQty += log.goodQty;
    summary.scrapQty += log.scrapQty;
    summary.reworkQty += log.reworkQty;
    summary.runMinutes += log.runMinutes;
  }

  let totalGood = 0;
  let totalScrap = 0;
  let totalRework = 0;
  let totalRunMinutes = 0;

  const workOrders: WorkOrderProductionSummary[] = [];

  for (const item of map.values()) {
    const totalProduced = item.goodQty + item.scrapQty;
    item.completionPct =
      item.plannedQty > 0 ? Math.round((item.goodQty / item.plannedQty) * 1000) / 10 : 0;
    item.scrapPct =
      totalProduced > 0 ? Math.round((item.scrapQty / totalProduced) * 1000) / 10 : 0;

    totalGood += item.goodQty;
    totalScrap += item.scrapQty;
    totalRework += item.reworkQty;
    totalRunMinutes += item.runMinutes;

    workOrders.push(item);
  }

  const overallProduced = totalGood + totalScrap;
  const overallScrapPct =
    overallProduced > 0 ? Math.round((totalScrap / overallProduced) * 1000) / 10 : 0;

  return {
    workOrders,
    totalGood,
    totalScrap,
    totalRework,
    totalRunMinutes,
    overallScrapPct,
  };
}

// ------------------------------------------------------------------ 2. Stock Valuation Register

export interface StockItemInput {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  unitCostPaise: number;
  materialClass?: string | null;
}

export interface StockValuationItemDto {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  unitCostPaise: number;
  valuationPaise: number;
  isBelowMinStock: boolean;
  materialClass: string;
}

export interface StockValuationRegisterDto {
  items: StockValuationItemDto[];
  totalValuationPaise: number;
  totalItems: number;
  lowStockItemCount: number;
}

export function buildStockValuationRegister(items: StockItemInput[]): StockValuationRegisterDto {
  let totalValuationPaise = 0;
  let lowStockItemCount = 0;

  const resultItems: StockValuationItemDto[] = items.map((it) => {
    const effectiveStock = Math.max(0, it.currentStock);
    const valuationPaise = Math.round(effectiveStock * it.unitCostPaise);
    const isBelowMinStock = it.currentStock < it.minStock;

    totalValuationPaise += valuationPaise;
    if (isBelowMinStock) lowStockItemCount++;

    return {
      id: it.id,
      sku: it.sku,
      name: it.name,
      unit: it.unit,
      currentStock: it.currentStock,
      minStock: it.minStock,
      unitCostPaise: it.unitCostPaise,
      valuationPaise,
      isBelowMinStock,
      materialClass: it.materialClass || "C",
    };
  });

  return {
    items: resultItems,
    totalValuationPaise,
    totalItems: resultItems.length,
    lowStockItemCount,
  };
}

// ------------------------------------------------------------------ 3. Job Profitability Register

export interface JobCostingInput {
  workOrderId: string;
  woNumber: string;
  customerName: string;
  revenuePaise: number;
  materialCostPaise: number;
  laborCostPaise: number;
  overheadCostPaise: number;
  scrapCostPaise: number;
}

export type JobProfitabilityStatus = "PROFITABLE" | "BREAKEVEN" | "UNPROFITABLE";

export interface JobProfitabilityDto {
  workOrderId: string;
  woNumber: string;
  customerName: string;
  revenuePaise: number;
  materialCostPaise: number;
  laborCostPaise: number;
  overheadCostPaise: number;
  scrapCostPaise: number;
  totalCostPaise: number;
  grossProfitPaise: number;
  marginPct: number;
  status: JobProfitabilityStatus;
}

export function calculateJobProfitability(job: JobCostingInput): JobProfitabilityDto {
  const totalCostPaise =
    job.materialCostPaise + job.laborCostPaise + job.overheadCostPaise + job.scrapCostPaise;
  const grossProfitPaise = job.revenuePaise - totalCostPaise;

  const marginPct =
    job.revenuePaise > 0
      ? Math.round((grossProfitPaise / job.revenuePaise) * 1000) / 10
      : grossProfitPaise >= 0
        ? 0
        : -100;

  let status: JobProfitabilityStatus = "BREAKEVEN";
  if (marginPct > 15) {
    status = "PROFITABLE";
  } else if (marginPct < 0) {
    status = "UNPROFITABLE";
  }

  return {
    workOrderId: job.workOrderId,
    woNumber: job.woNumber,
    customerName: job.customerName,
    revenuePaise: job.revenuePaise,
    materialCostPaise: job.materialCostPaise,
    laborCostPaise: job.laborCostPaise,
    overheadCostPaise: job.overheadCostPaise,
    scrapCostPaise: job.scrapCostPaise,
    totalCostPaise,
    grossProfitPaise,
    marginPct,
    status,
  };
}

// ------------------------------------------------------------------ 4. Supplier Scorecards

export interface SupplierPoRecord {
  supplierId: string;
  supplierName: string;
  poNumber: string;
  orderedQty: number;
  receivedQty: number;
  expectedDate?: Date | null;
  receivedAt?: Date | null;
  rejectedQty: number;
}

export interface SupplierScorecardDto {
  supplierId: string;
  supplierName: string;
  totalOrders: number;
  onTimeOrders: number;
  otdPct: number;
  totalReceivedQty: number;
  totalRejectedQty: number;
  qualityAcceptancePct: number;
  rating: number;
}

export function buildSupplierScorecards(records: SupplierPoRecord[]): SupplierScorecardDto[] {
  const map = new Map<
    string,
    {
      supplierId: string;
      supplierName: string;
      totalOrders: number;
      onTimeOrders: number;
      totalReceived: number;
      totalRejected: number;
    }
  >();

  for (const r of records) {
    let entry = map.get(r.supplierId);
    if (!entry) {
      entry = {
        supplierId: r.supplierId,
        supplierName: r.supplierName,
        totalOrders: 0,
        onTimeOrders: 0,
        totalReceived: 0,
        totalRejected: 0,
      };
      map.set(r.supplierId, entry);
    }

    entry.totalOrders++;

    if (r.expectedDate && r.receivedAt) {
      const exp = new Date(r.expectedDate).getTime();
      const rec = new Date(r.receivedAt).getTime();
      if (rec <= exp) {
        entry.onTimeOrders++;
      }
    }

    entry.totalReceived += r.receivedQty;
    entry.totalRejected += r.rejectedQty;
  }

  const scorecards: SupplierScorecardDto[] = [];

  for (const e of map.values()) {
    const otdPct =
      e.totalOrders > 0 ? Math.round((e.onTimeOrders / e.totalOrders) * 1000) / 10 : 100.0;
    const acceptedQty = Math.max(0, e.totalReceived - e.totalRejected);
    const qualityAcceptancePct =
      e.totalReceived > 0 ? Math.round((acceptedQty / e.totalReceived) * 1000) / 10 : 100.0;

    // 5-star rating based on 60% OTD + 40% Quality
    const score = (otdPct * 0.6 + qualityAcceptancePct * 0.4) / 20; // 0..5
    const rating = Math.max(1, Math.min(5, Math.round(score * 10) / 10));

    scorecards.push({
      supplierId: e.supplierId,
      supplierName: e.supplierName,
      totalOrders: e.totalOrders,
      onTimeOrders: e.onTimeOrders,
      otdPct,
      totalReceivedQty: e.totalReceived,
      totalRejectedQty: e.totalRejected,
      qualityAcceptancePct,
      rating,
    });
  }

  return scorecards;
}

// ------------------------------------------------------------------ 5. Sales & GST Register

export interface InvoiceRegisterInput {
  invoiceNumber: string;
  customerName: string;
  customerGstin?: string | null;
  invoiceDate: Date;
  taxableValuePaise: number;
  taxType: "INTRA" | "INTER";
  taxRatePct: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalValuePaise: number;
  paidAmountPaise: number;
  status: string;
}

export interface SalesGstRegisterDto {
  invoices: InvoiceRegisterInput[];
  totalTaxablePaise: number;
  totalCgstPaise: number;
  totalSgstPaise: number;
  totalIgstPaise: number;
  totalValuePaise: number;
  totalPaidPaise: number;
  totalBalanceDuePaise: number;
}

export function buildSalesGstRegister(invoices: InvoiceRegisterInput[]): SalesGstRegisterDto {
  let totalTaxablePaise = 0;
  let totalCgstPaise = 0;
  let totalSgstPaise = 0;
  let totalIgstPaise = 0;
  let totalValuePaise = 0;
  let totalPaidPaise = 0;

  for (const inv of invoices) {
    totalTaxablePaise += inv.taxableValuePaise;
    totalCgstPaise += inv.cgstPaise;
    totalSgstPaise += inv.sgstPaise;
    totalIgstPaise += inv.igstPaise;
    totalValuePaise += inv.totalValuePaise;
    totalPaidPaise += inv.paidAmountPaise;
  }

  const totalBalanceDuePaise = Math.max(0, totalValuePaise - totalPaidPaise);

  return {
    invoices,
    totalTaxablePaise,
    totalCgstPaise,
    totalSgstPaise,
    totalIgstPaise,
    totalValuePaise,
    totalPaidPaise,
    totalBalanceDuePaise,
  };
}
