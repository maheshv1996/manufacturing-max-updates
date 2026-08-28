import { prisma } from "./prisma";

export async function fetchLiveDossierData(workOrderId: string) {
  return prisma.workOrder.findUnique({
    where: { id: workOrderId },
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
}
