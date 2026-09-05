import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserFromHeaders } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toApiError, forbidden, notFound, validation } from "@/lib/core/errors";
import { checkReadiness, type ReadinessSnapshot } from "@/lib/shopfloor/readiness";
import { resolveFixtureForProduct } from "@/lib/fixtureGate";

export const dynamic = "force-dynamic";

function requireAuth(user: ReturnType<typeof getUserFromHeaders>): void {
  if (!user.id) throw forbidden("Authentication required");
}

/**
 * GET ?workOrderId=… — readiness for a WO, per the pure engine (DEPTH_04 W2
 * step 2). Server-assembled snapshot today: fixture status + FAI state + WO
 * status (guardrails G-1/G-2 enforced here already). Material shortages,
 * certs, drawing-rev and calibration flags join the snapshot when their owning
 * cycles land (C5 supply / C3 quality / C4 change); the engine already types
 * those gaps so no caller changes.
 */
export async function GET(req: Request) {
  try {
    const headersList = await headers();
    const user = getUserFromHeaders(headersList);
    requireAuth(user);

    const workOrderId = new URL(req.url).searchParams.get("workOrderId")?.trim() ?? "";
    if (!workOrderId) throw validation("workOrderId query parameter is required");

    const wo = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        woNumber: true,
        status: true,
        productId: true,
        plantId: true,
        faiRequired: true,
        faiReports: { select: { status: true } },
      },
    });
    if (!wo) throw notFound("Work order not found");

    const fixture = wo.productId ? await resolveFixtureForProduct(wo.productId, wo.plantId ?? undefined) : null;
    const fixtureAvailable = fixture ? fixture.status === "AVAILABLE" : true; // no fixture registered → no gate
    const faiSatisfied = !wo.faiRequired || wo.faiReports.some((r) => r.status === "APPROVED");

    const snapshot: ReadinessSnapshot = {
      materials: [],
      certsRequired: false,
      certsPresent: true,
      drawingRevCurrent: true,
      fixtureAvailable,
      assignedInstrumentsCalibrated: true,
      faiRequired: wo.faiRequired,
      faiSatisfied,
    };

    const result = checkReadiness(snapshot);
    return NextResponse.json({
      workOrderId: wo.id,
      woNumber: wo.woNumber,
      status: wo.status,
      ready: result.ready,
      gaps: result.gaps,
      note: "Material/cert/rev/calibration snapshot joins when C3/C4/C5 land",
    });
  } catch (e) {
    const api = toApiError(e);
    const status =
      api.error === "FORBIDDEN" ? 403 : api.error === "NOT_FOUND" ? 404 : api.error === "VALIDATION" ? 422 : 400;
    return NextResponse.json(api, { status });
  }
}
