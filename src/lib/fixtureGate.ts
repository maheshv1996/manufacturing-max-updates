import { prisma } from "./prisma";

/**
 * P4 — Tooling & Fixture gate. A Work Order cannot be started unless the
 * product's fixture (if one exists) is AVAILABLE. Managers can override with a
 * written reason; the override is audited FIXTURE_OVERRIDE by the caller.
 */
export type FixtureGateResult = {
  blocked: boolean;
  error?: string;
  fixture?: {
    id: string;
    code: string;
    name: string;
    status: string;
  };
};

export async function resolveFixtureForProduct(productId: string) {
  return prisma.fixture.findFirst({ where: { productId } });
}

export async function checkFixtureGate(
  workOrderId: string,
): Promise<FixtureGateResult> {
  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { productId: true, woNumber: true, status: true },
  });
  if (!wo) return { blocked: false, error: undefined };

  const fixture = await resolveFixtureForProduct(wo.productId);
  if (!fixture) {
    // No fixture registered for the product → no gate to enforce.
    return { blocked: false };
  }
  if (fixture.status === "AVAILABLE") {
    return { blocked: false, fixture };
  }
  return {
    blocked: true,
    fixture: {
      id: fixture.id,
      code: fixture.code,
      name: fixture.name,
      status: fixture.status,
    },
    error: `WO ${wo.woNumber} cannot start — fixture ${fixture.code} (${fixture.name}) is ${fixture.status}. Return it to service or override with a manager reason.`,
  };
}
