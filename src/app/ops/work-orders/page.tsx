import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Clock,
  Cpu,
  Package,
  ClipboardList,
} from "lucide-react";
import {
  getWorkOrdersData,
  getProductsData,
  getMachinesData,
} from "@/lib/data";

export const maxDuration = 60;
import { parseDateRange } from "@/lib/date-utils";
import { getPlantScope } from "@/lib/plantScope";
import { calculateWorkOrderReadiness } from "@/lib/readinessEngine";
import WorkOrdersClientHeader from "@/app/components/workorder/WorkOrdersClientHeader";
import CopyTrackingButton from "@/app/components/workorder/CopyTrackingButton";
import { Card } from "@/app/components/ui/Card";
import { StatusPill } from "@/app/components/ui/StatusPill";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Button } from "@/app/components/ui/Button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getStatusVariant(
  status: string,
): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "PLANNED":
      return "info";
    case "IN_PROGRESS":
      return "warning";
    case "COMPLETED":
      return "success";
    case "ON_HOLD":
      return "danger";
    default:
      return "neutral";
  }
}

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/ops/work-orders");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    if (!user.id && !user.isOwner) {
      redirect("/login?redirectTo=/ops/work-orders");
    }
    redirect("/");
  }

  const params = await searchParams;
  const statusFilter = params.status || "ALL";

  const parsedRange = parseDateRange({}); // defaults to 30d
  const plantId = await getPlantScope();

  const [workOrders, products, { machines }] = await Promise.all([
    getWorkOrdersData(statusFilter, plantId),
    getProductsData(),
    getMachinesData(parsedRange, plantId),
  ]);

  return (
    <div className="max-w-7xl mx-auto">
      <WorkOrdersClientHeader
        products={products}
        machines={machines}
        activeStatus={statusFilter}
      />

      <div className="grid grid-cols-1 gap-4 pt-4">
        {workOrders.map((wo: any) => {
          const isOpen =
            wo.status === "PLANNED" ||
            wo.status === "IN_PROGRESS" ||
            wo.status === "ON_HOLD";
          const readiness = isOpen ? calculateWorkOrderReadiness(wo) : null;

          const totalGood = (wo.productionLogs || []).reduce(
            (sum: number, log: any) => sum + (log.goodQuantity || 0),
            0,
          );

          const plannedQty = wo.plannedQuantity || 1;
          const progressPct = Math.min(
            100,
            Number(((totalGood / plannedQty) * 100).toFixed(1)),
          );
          const assignedMachineCode =
            wo.productionLogs?.[0]?.machine?.code || "Unassigned";

          return (
            <Card key={wo.id} className="hover:border-accent transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="px-3 py-1.5 bg-accent-soft text-accent rounded-control font-mono font-bold text-sm">
                    {wo.woNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/ops/work-orders/${wo.id}`}
                        className="text-lg font-bold text-text-1 hover:text-accent transition-colors"
                      >
                        {wo.product?.name || "Product"}
                      </Link>
                      <span className="px-2 py-0.5 text-xs font-mono font-medium bg-surface-3 text-text-2 rounded-control">
                        {wo.product?.sku}
                      </span>
                      {wo.customerName && (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-info-soft text-info rounded-pill border border-info/20">
                          🏢 {wo.customerName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-2 flex items-center gap-2 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5" /> Machine:{" "}
                        {assignedMachineCode}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Start:{" "}
                        {new Date(wo.plannedStartDate).toLocaleDateString()}
                      </span>
                      {wo.promisedDispatchDate && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-semibold text-success">
                            <Clock className="w-3.5 h-3.5" /> Dispatch:{" "}
                            {new Date(
                              wo.promisedDispatchDate,
                            ).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <CopyTrackingButton
                    trackingToken={wo.trackingToken}
                    woNumber={wo.woNumber}
                  />

                  {readiness && (
                    <StatusPill
                      variant={
                        readiness.overallStatus === "READY"
                          ? "success"
                          : "danger"
                      }
                      label={
                        readiness.overallStatus === "READY"
                          ? "Ready"
                          : `Short: ${readiness.shortageMaterialsText}`
                      }
                    />
                  )}

                  <StatusPill
                    variant={getStatusVariant(wo.status)}
                    label={wo.status.replace("_", " ")}
                  />

                  <Link href={`/ops/work-orders/${wo.id}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="View Details"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* PROGRESS BAR DISPLAY */}
              <div className="mt-4 bg-surface-2 p-3.5 rounded-control border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text-2 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-accent" />
                    Production Progress
                  </span>
                  <span className="font-mono font-bold text-text-1 tabular-nums">
                    {totalGood.toLocaleString()} / {plannedQty.toLocaleString()}{" "}
                    units ({progressPct}%)
                  </span>
                </div>
                <div className="w-full bg-surface-3 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      progressPct >= 100
                        ? "bg-success"
                        : progressPct > 0
                          ? "bg-accent"
                          : "bg-text-3"
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </Card>
          );
        })}

        {workOrders.length === 0 && (
          <Card>
            <EmptyState
              icon={<ClipboardList />}
              title="No Work Orders Found"
              description={`No work orders match status filter "${statusFilter}".`}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
