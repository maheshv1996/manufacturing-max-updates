import { prisma } from "./prisma";

export async function fetchLiveDossierData(workOrderId: string) {
  const cleanId = String(workOrderId || "").trim();
  if (!cleanId) return null;

  try {
    const workOrder = await prisma.workOrder.findUnique({
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

    if (!workOrder) return null;

    // Auto-attach PPAP Submissions for the product to complete aerospace/automotive dossier
    let ppapSubmissions: any[] = [];
    if (workOrder.productId) {
      try {
        ppapSubmissions = await prisma.ppapSubmission.findMany({
          where: { productId: workOrder.productId },
          include: { elements: { orderBy: { elementNo: "asc" } } },
          orderBy: { createdAt: "desc" },
        });
      } catch {}
    }

    return {
      ...workOrder,
      ppapSubmissions,
    };
  } catch (err) {
    console.error(`Failed to fetch live dossier data for work order ${cleanId}:`, err);
    return null;
  }
}
