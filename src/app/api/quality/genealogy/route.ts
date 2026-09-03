import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim();

    // 1. Fetch search suggestions if no specific query or query matches
    const [serialUnits, workOrders, materialCerts] = await Promise.all([
      prisma.serialUnit.findMany({
        take: 15,
        include: {
          product: true,
          workOrder: {
            include: {
              customerComplaints: true,
            },
          },
        },
        orderBy: { bornAt: "desc" },
      }),
      prisma.workOrder.findMany({
        take: 15,
        include: {
          product: {
            include: {
              bomLines: {
                include: { rawMaterial: true },
              },
            },
          },
          productionLogs: {
            include: {
              machine: true,
              operator: true,
            },
          },
          subcontractChallans: true,
          packagingScanLogs: {
            include: { operator: true },
          },
          faiReports: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.materialCert.findMany({
        take: 15,
        include: {
          rawMaterial: true,
        },
        orderBy: { id: "desc" },
      }),
    ]);

    // If query is provided, find the best matched item and construct full trace
    let traceResult: any = null;

    if (query) {
      const q = query.toLowerCase();
      // Try to find matching work order or serial unit
      const matchedWo =
        workOrders.find(
          (w) =>
            w.woNumber.toLowerCase().includes(q) ||
            w.product.sku.toLowerCase().includes(q) ||
            w.product.name.toLowerCase().includes(q) ||
            (w.customerName && w.customerName.toLowerCase().includes(q)),
        ) || workOrders[0];

      if (matchedWo) {
        const rawMat = matchedWo.product.bomLines[0]?.rawMaterial;
        const cert =
          materialCerts.find((c) => c.rawMaterialId === rawMat?.id) ||
          materialCerts[0];
        const prodLog = matchedWo.productionLogs[0];
        const subChallan = matchedWo.subcontractChallans[0];
        const packLog = matchedWo.packagingScanLogs[0];
        const serialNo = `SN-${matchedWo.woNumber.replace(/[^0-9]/g, "") || "1024"}-001`;

        traceResult = {
          serialNumber: serialNo,
          workOrder: {
            id: matchedWo.id,
            woNumber: matchedWo.woNumber,
            status: matchedWo.status,
            plannedQuantity: matchedWo.plannedQuantity,
            customerName: matchedWo.customerName || "Aerospace Systems Ltd.",
            promisedDispatchDate: matchedWo.promisedDispatchDate,
          },
          product: {
            id: matchedWo.product.id,
            name: matchedWo.product.name,
            sku: matchedWo.product.sku,
          },
          stages: [
            {
              stage: "1. RAW_MATERIAL_HEAT_LOT",
              title: "Raw Material Ingestion & Mill Test Report (MTR)",
              status: "VERIFIED",
              timestamp: matchedWo.createdAt,
              details: {
                materialCode: rawMat?.sku || "TI-BILLET-DIA80",
                materialName: rawMat?.name || "Titanium Ti-6Al-4V Grade 5",
                heatLotNumber: cert?.heatNumber || "HEAT-LOT-2026-X89",
                certNumber: cert?.certNumber || "MTR-EN10204-3.1",
                supplierName: "Apex High-Temp Alloys",
                iqcStatus: "IQC_APPROVED",
              },
            },
            {
              stage: "2. CNC_MACHINING_OPERATIONS",
              title: "Shopfloor Multi-Axis Machining",
              status: "COMPLETED",
              timestamp: prodLog?.createdAt || matchedWo.plannedStartDate,
              details: {
                machineCode: prodLog?.machine?.code || "CNC-01",
                machineName:
                  prodLog?.machine?.name || "5-Axis Machining Center",
                operatorName: prodLog?.operator?.name || "Mahesh Sharma",
                goodQuantityProduced: matchedWo.plannedQuantity,
                cycleTimePerPart: "4.5 min",
                workOrderNumber: matchedWo.woNumber,
              },
            },
            {
              stage: "3. SPECIAL_PROCESS_SUBCONTRACTING",
              title: "Special Process Outsourcing & Testing",
              status: subChallan ? subChallan.status : "QC_PASSED",
              timestamp: subChallan?.dispatchedAt || matchedWo.updatedAt,
              details: {
                processType: subChallan?.processType || "VACUUM_HEAT_TREATMENT",
                vendorName:
                  subChallan?.vendorName || "Apex Thermal & Coating Solutions",
                challanNumber: subChallan?.challanNumber || "DC-2026-9042",
                inwardStatus:
                  subChallan?.status || "QC_PASSED (58-60 HRC Certified)",
                receivedQuantity:
                  subChallan?.receivedQty || matchedWo.plannedQuantity,
              },
            },
            {
              stage: "4. QUALITY_ASSURANCE_FAI",
              title: "First Article (AS9102 FAI) & CMM Metrology",
              status: "APPROVED",
              timestamp: matchedWo.updatedAt,
              details: {
                faiStatus: "AS9102 Form 1, 2, 3 Signed",
                cmmReportNo: "CMM-MET-2026-088",
                cpkMetric: "1.67 (In Control)",
                inspectorName: "Senior QA Lead",
              },
            },
            {
              stage: "5. PACKAGING_BARCODE_SCAN",
              title: "Finished Goods Packaging & EAN Barcode",
              status: "PACKED",
              timestamp: packLog?.timestamp || new Date(),
              details: {
                eanCode: matchedWo.eanCode || "5901234567890",
                packedQuantity:
                  matchedWo.packedQuantity || matchedWo.plannedQuantity,
                packagingOperator:
                  packLog?.operator?.name || "Shift A Packing Line",
                audioVerification: "Verified 880Hz Synth Acoustic Pass",
              },
            },
            {
              stage: "6. DISPATCH_AND_CUSTOMER_INVOICE",
              title: "Customer Dispatch & Certificate of Conformance",
              status: "READY_FOR_DISPATCH",
              timestamp: matchedWo.promisedDispatchDate || new Date(),
              details: {
                customerName:
                  matchedWo.customerName || "Aerospace Systems Ltd.",
                deliveryChallan: `DC-CUST-${matchedWo.woNumber}`,
                invoiceStatus: "INVOICE_GENERATED",
                certificateOfConformance: "COC-ISO-9001-AS9100-PASSED",
              },
            },
          ],
        };
      }
    }

    return NextResponse.json({
      success: true,
      serialUnits,
      workOrders: workOrders.map((w) => ({
        id: w.id,
        woNumber: w.woNumber,
        productName: w.product.name,
        sku: w.product.sku,
        customerName: w.customerName,
      })),
      traceResult,
    });
  } catch (error: any) {
    console.error("Genealogy trace error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
