import { prisma } from "@/lib/prisma";
import MaterialPlanClient from "./MaterialPlanClient";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 0;

export default async function MaterialPlanPage() {
  const [workOrders, rawMaterials] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        status: {
          in: ["PLANNED", "IN_PROGRESS", "ON_HOLD"],
        },
      },
      include: {
        product: {
          include: {
            bomLines: {
              include: {
                rawMaterial: {
                  include: { supplier: true },
                },
              },
            },
          },
        },
      } as any,
      orderBy: { plannedStartDate: "asc" },
    }),
    prisma.rawMaterial.findMany({
      where: { isActive: true },
      include: { supplier: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <MaterialPlanClient
      initialWorkOrders={JSON.parse(JSON.stringify(workOrders))}
      allRawMaterials={JSON.parse(JSON.stringify(rawMaterials))}
    />
  );
}
