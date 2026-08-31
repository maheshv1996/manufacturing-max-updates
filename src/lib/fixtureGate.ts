import { prisma } from "./prisma";

/**
 * P4 — Tooling & Fixture Gate.
 * A Work Order cannot be started unless the product's associated fixture (if one exists)
 * is in AVAILABLE status. Managers can override with a written justification.
 */
export type FixtureGateResult = {
  blocked: boolean;
  error?: string;
  fixture?: {
    id: string;
    code: string;
    name: string;
    status: string;
    location?: string | null;
  };
};

export async function resolveFixtureForProduct(
  productId: string,
  plantId?: string,
) {
  const where: any = { productId };
  if (plantId && plantId !== "ALL") {
    where.plantId = plantId;
  }

  return prisma.fixture.findFirst({
    where,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
}

export async function checkFixtureGate(
  workOrderId: string,
  plantId?: string,
): Promise<FixtureGateResult> {
  const cleanWoId = String(workOrderId || "").trim();
  if (!cleanWoId) {
    return { blocked: false };
  }

  const wo = await prisma.workOrder.findUnique({
    where: { id: cleanWoId },
    select: {
      productId: true,
      woNumber: true,
      status: true,
      plantId: true,
    },
  });

  if (!wo) {
    return { blocked: false };
  }

  // If the work order is already COMPLETED, do not gate retroactively
  if (wo.status === "COMPLETED") {
    return { blocked: false };
  }

  const effectivePlantId = plantId || wo.plantId || undefined;
  const fixture = await resolveFixtureForProduct(wo.productId, effectivePlantId);

  if (!fixture) {
    // No fixture registered for the product → no gate to enforce
    return { blocked: false };
  }

  if (fixture.status === "AVAILABLE") {
    return {
      blocked: false,
      fixture: {
        id: fixture.id,
        code: fixture.code,
        name: fixture.name,
        status: fixture.status,
        location: fixture.location,
      },
    };
  }

  const statusLabel = fixture.status.replace(/_/g, " ").toUpperCase();

  return {
    blocked: true,
    fixture: {
      id: fixture.id,
      code: fixture.code,
      name: fixture.name,
      status: fixture.status,
      location: fixture.location,
    },
    error: `Work Order ${wo.woNumber} cannot start — tooling fixture ${fixture.code} (${fixture.name}) is currently ${statusLabel}. Return it to service or provide an authorized manager override.`,
  };
}
