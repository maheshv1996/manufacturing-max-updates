import { prisma } from "./prisma";

export async function fetchLiveDossierData(workOrderId: string) {
  const cleanId = String(workOrderId || "").trim();
  if (!cleanId) return null;

  try {
    return await prisma.workOrder.findUnique({
      where: { id: cleanId },
      include: {
        product: {
          include: {
            routingSteps: {
              include: { operation: true },
              orderBy: { seq: "asc" },
            },
            bomLines: {
              include: {
                rawMaterial: {
                  include: { supplier: true },
                },
              },
            },
            qcParameters: true,
          },
        },
        productionLogs: {
          include: { machine: true, operator: true },
          orderBy: { startTime: "asc" },
        },
        inventoryTransactions: {
          include: { rawMaterial: true, materialCert: true },
          orderBy: { at: "asc" },
        },
        faiReports: {
          orderBy: { submittedAt: "desc" },
        },
        ncrReports: {
          include: {
            defectCode: true,
            approvedBy: true,
          },
          orderBy: { raisedAt: "asc" },
        },
        holdPointSignoffs: {
          include: {
            routingStep: true,
          },
          orderBy: { signedAt: "asc" },
        },
        serialUnits: {
          include: { events: { orderBy: { at: "asc" } } },
          orderBy: { serialNo: "asc" },
        },
        qualityInspections: {
          include: {
            inspector: true,
          },
          orderBy: { inspectedAt: "asc" },
        },
      } as any,
    });
  } catch (err) {
    console.error(`Failed to fetch live dossier data for work order ${cleanId}:`, err);
    return null;
  }
}
