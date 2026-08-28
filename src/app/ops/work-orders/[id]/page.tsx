import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  Package,
  User as UserIcon,
  Truck,
} from "lucide-react";
import { getWorkOrderDetailData } from "@/lib/data";
import { calculateWorkOrderCost } from "@/lib/costingEngine";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import WorkOrderReadinessCard from "@/app/components/workorder/WorkOrderReadinessCard";
import WorkOrderDrawingsCard from "@/app/components/workorder/WorkOrderDrawingsCard";
import WorkOrderFinancialCard from "@/app/components/workorder/WorkOrderFinancialCard";
import WorkOrderDispatchesCard from "@/app/components/workorder/WorkOrderDispatchesCard";
import WorkOrderTablesWithEdits from "@/app/components/workorder/WorkOrderTablesWithEdits";
import WorkOrderSerialsCard from "@/app/components/workorder/WorkOrderSerialsCard";
import WorkOrderDataPackageCard from "@/app/components/workorder/WorkOrderDataPackageCard";
import WorkOrderStandardTimeCard from "@/app/components/workorder/WorkOrderStandardTimeCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getStatusChip(status: string) {
  switch (status) {
    case "PLANNED":
      return {
        label: "PLANNED",
        colorClass:
          "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 text-blue-300 dark:border-blue-800",
        dotClass: "bg-blue-500",
      };
    case "IN_PROGRESS":
      return {
        label: "IN PROGRESS",
        colorClass:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 text-emerald-300 dark:border-emerald-800",
        dotClass: "bg-emerald-500 animate-pulse",
      };
    case "COMPLETED":
      return {
        label: "COMPLETED",
        colorClass: "bg-slate-800/60 text-slate-300 border-slate-600",
        dotClass: "bg-slate-400",
      };
    case "ON_HOLD":
      return {
        label: "ON HOLD",
        colorClass:
          "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 text-amber-300 dark:border-amber-800",
        dotClass: "bg-amber-500",
      };
    default:
      return {
        label: status,
        colorClass: "bg-slate-800/60 text-slate-300 border-slate-600",
        dotClass: "bg-slate-400",
      };
  }
}

function getCategoryBadgeClass(category: string) {
  switch (category) {
    case "MECHANICAL":
    case "ELECTRICAL":
      return "bg-rose-100 text-rose-700 dark:bg-rose-950 text-rose-300";
    case "MATERIAL":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950 text-amber-300";
    case "QUALITY":
      return "bg-orange-100 text-orange-700 dark:bg-orange-950 text-orange-300";
    case "OPERATOR":
      return "bg-purple-100 text-purple-700 dark:bg-purple-950 text-purple-300";
    default:
      return "bg-slate-800/60 text-slate-300";
  }
}

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [wo, suppliers, downtimeReasons] = await Promise.all([
    getWorkOrderDetailData(id),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.downtimeReason.findMany({ orderBy: { code: "asc" } }),
  ]);

  if (!wo) {
    notFound();
  }

  const documents = await (prisma as any).document.findMany({
    where: { productId: wo.productId },
    include: {
      product: { select: { name: true, sku: true } },
      operation: { select: { name: true, code: true } },
    },
    orderBy: [{ operationId: "asc" }, { version: "desc" }],
  });

  const costing = await calculateWorkOrderCost(wo);
  const chip = getStatusChip(wo.status);

  // Sum good, scrap, rework quantities
  const totalGood = (wo.productionLogs || []).reduce(
    (sum: number, log: any) => sum + (log.goodQuantity || 0),
    0,
  );
  const totalScrap = (wo.productionLogs || []).reduce(
    (sum: number, log: any) => sum + (log.scrapQuantity || 0),
    0,
  );
  const totalRework = (wo.productionLogs || []).reduce(
    (sum: number, log: any) => sum + (log.reworkQuantity || 0),
    0,
  );

  const plannedQty = wo.plannedQuantity || 1;
  const progressPct = Math.min(
    100,
    Number(((totalGood / plannedQty) * 100).toFixed(1)),
  );

  const assignedMachines = (wo.productionLogs || [])
    .map((log: any) => log.machine?.name || log.machine?.code)
    .filter(Boolean);
  const uniqueMachines =
    Array.from(new Set(assignedMachines)).join(", ") || "Unassigned";

  // Routing & traveler data
  const routingSteps: any[] = wo.product?.routingSteps || [];
  const currentSeq: number = wo.currentSeq || 1;
  const currentStep = routingSteps.find((s: any) => s.seq === currentSeq);
  const movementLogs: any[] = wo.movementLogs || [];
  const totalMoved = movementLogs.reduce(
    (sum: number, m: any) => sum + m.quantity,
    0,
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* NAV BACK BUTTON */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/ops/work-orders"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-200 bg-slate-800/60 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Work Orders
          </Link>
          <PrintButton />
        </div>

        {/* HEADER CARD */}
        <header className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-400 rounded-xl font-mono font-bold text-lg">
                {wo.woNumber}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                    {wo.product?.name || "Work Order Detail"}
                  </h1>
                  <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-slate-800/60 text-slate-300 rounded border border-slate-600">
                    {wo.product?.sku}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold border rounded-full ${chip.colorClass}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${chip.dotClass}`} />
                    {chip.label}
                  </span>
                </div>
                <p className="text-sm text-slate-400 flex items-center gap-4 mt-2 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-slate-400" />
                    Machine(s):{" "}
                    <strong className="text-slate-200">{uniqueMachines}</strong>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    Planned:{" "}
                    {new Date(wo.plannedStartDate).toLocaleDateString()} —{" "}
                    {new Date(wo.plannedEndDate).toLocaleDateString()}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* PROGRESS SUMMARY BANNER */}
          <div className="p-5 bg-slate-800/60 rounded-xl border border-slate-700 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
              <span className="font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" />
                Production Progress Breakdown
              </span>
              <span className="font-mono font-extrabold text-white text-base">
                {totalGood.toLocaleString()} Good /{" "}
                {plannedQty.toLocaleString()} Planned ({progressPct}%)
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-700/40 h-3 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progressPct >= 100
                    ? "bg-emerald-500"
                    : progressPct > 0
                      ? "bg-blue-500"
                      : "bg-slate-400"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 pt-1 text-xs">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 rounded-lg">
                <span className="text-slate-400 block font-medium">
                  Good Units
                </span>
                <span className="text-lg font-bold text-emerald-400">
                  {totalGood.toLocaleString()}
                </span>
              </div>
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 rounded-lg">
                <span className="text-slate-400 block font-medium">
                  Scrap Units
                </span>
                <span className="text-lg font-bold text-rose-400">
                  {totalScrap.toLocaleString()}
                </span>
              </div>
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50 rounded-lg">
                <span className="text-slate-400 block font-medium">
                  Rework Units
                </span>
                <span className="text-lg font-bold text-amber-400">
                  {totalRework.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* SERIALIZATION CARD (Only renders in SERIAL mode) */}
        <WorkOrderSerialsCard wo={wo} />

        {/* DATA PACKAGE / BIRTH RECORD CARD */}
        <WorkOrderDataPackageCard wo={wo} />

        {/* MATERIAL READINESS CARD */}
        <WorkOrderReadinessCard workOrder={wo} suppliers={suppliers} />

        {/* DRAWINGS & SOPS CARD */}
        <WorkOrderDrawingsCard
          productName={wo.product?.name || "Product"}
          woNumber={wo.woNumber}
          documents={JSON.parse(JSON.stringify(documents))}
        />

        {/* ── JOB COSTING & PROFITABILITY CARD ── */}
        <WorkOrderFinancialCard wo={wo} costing={costing} />

        {/* ── STANDARD vs ACTUAL TIME CARD (Industrial Engineering) ── */}
        <WorkOrderStandardTimeCard wo={wo} />

        {/* ── DISPATCHES & GST TAX INVOICING CARD ── */}
        <WorkOrderDispatchesCard wo={wo} />

        {/* ── LOGS & TRACEABILITY TABLES WITH SOURCE EDIT MODALS ── */}
        <WorkOrderTablesWithEdits wo={wo} downtimeReasons={downtimeReasons} />

        {/* JOB TRAVELER SECTION */}
        {routingSteps.length > 0 && (
          <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-6">
            {/* WIP Banner */}
            <div className="flex items-center gap-3 p-4 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 rounded-xl">
              <Truck className="w-5 h-5 text-cyan-400 shrink-0" />
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 block">
                  WIP Status
                </span>
                <span className="text-base font-bold text-white">
                  {currentStep
                    ? `Now at: ${currentStep.stationName} — ${currentStep.operation?.code} ${currentStep.operation?.name}`
                    : "Routing complete"}
                  {totalMoved > 0 && (
                    <span className="text-sm text-cyan-400 font-normal ml-2">
                      ({totalMoved.toLocaleString()} pcs moved)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Traveler Timeline */}
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-cyan-500" />
                Job Traveler
              </h2>
              <div className="flex flex-wrap gap-0">
                {routingSteps.map((step: any, idx: number) => {
                  const isDone = step.seq < currentSeq;
                  const isActive = step.seq === currentSeq;
                  return (
                    <div key={step.id} className="flex items-center">
                      <div
                        className={`flex flex-col items-center px-4 py-3 rounded-xl border-2 transition-all ${
                          isDone
                            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-300"
                            : isActive
                              ? "bg-cyan-50 dark:bg-cyan-950/60 border-cyan-400 dark:border-cyan-500 text-cyan-200 shadow-md ring-2 ring-cyan-300 dark:ring-cyan-700"
                              : "bg-slate-800/60 border-slate-600 text-slate-500"
                        }`}
                      >
                        <span className="text-xs font-mono font-bold">
                          {step.operation?.code}
                        </span>
                        <span className="text-sm font-bold mt-0.5">
                          {step.operation?.name}
                        </span>
                        <span className="text-xs text-slate-400 mt-0.5">
                          📍 {step.stationName}
                        </span>
                        {step.standardCycleTimeSeconds && (
                          <span className="text-xs text-slate-400 font-mono">
                            ⏱ {step.standardCycleTimeSeconds}s
                          </span>
                        )}
                        <span
                          className={`mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                            isDone
                              ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-300"
                              : isActive
                                ? "bg-cyan-100 dark:bg-cyan-900 text-cyan-300"
                                : "bg-slate-700/40 text-slate-400"
                          }`}
                        >
                          {isDone
                            ? "✓ Done"
                            : isActive
                              ? "▶ Active"
                              : "Pending"}
                        </span>
                        {step.isHoldPoint && (
                          <div className="mt-2 flex flex-col items-center">
                            <span className="text-[10px] font-bold text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                              ✋ HOLD POINT
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5 text-center leading-tight">
                              {step.holdAuthority}
                            </span>
                            {(() => {
                              const signoffs = (
                                wo.holdPointSignoffs || []
                              ).filter((s: any) => s.routingStepId === step.id);
                              if (signoffs.length > 0) {
                                return (
                                  <span className="text-[10px] text-emerald-400 mt-0.5 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {signoffs.length} Signed
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                      {idx < routingSteps.length - 1 && (
                        <ArrowRight
                          className={`w-5 h-5 mx-2 shrink-0 ${
                            step.seq < currentSeq
                              ? "text-emerald-400"
                              : "text-slate-600"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Material Movement History */}
            {movementLogs.length > 0 && (
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2 mb-3 border-t border-slate-700 pt-4">
                  <Truck className="w-4 h-4 text-slate-500" />
                  Material Movement History
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4 rounded-l-lg font-semibold">
                          From Station
                        </th>
                        <th className="py-2.5 px-4 font-semibold">
                          To Station
                        </th>
                        <th className="py-2.5 px-4 font-semibold">Qty (pcs)</th>
                        <th className="py-2.5 px-4 font-semibold">Moved By</th>
                        <th className="py-2.5 px-4 rounded-r-lg font-semibold">
                          Time
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 divide-slate-800">
                      {movementLogs.map((log: any) => (
                        <tr
                          key={log.id}
                          className="hover:bg-slate-50/60 hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 text-slate-300 font-mono text-xs">
                            {log.fromStation}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-950 text-cyan-300 rounded text-xs font-mono">
                              {log.toStation}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            {log.quantity.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {log.movedByName}
                          </td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-xs">
                            {new Date(log.at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* PRODUCTION LOGS TABLE */}
        <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-blue-500" />
              Production Logs
            </h2>
            <span className="text-xs text-slate-400">
              Showing {(wo.productionLogs || []).length} shifts / logs
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs tracking-wider">
                <tr>
                  <th className="py-3 px-4 rounded-l-lg font-semibold">
                    Operator
                  </th>
                  <th className="py-3 px-4 font-semibold">Shift</th>
                  <th className="py-3 px-4 font-semibold">Machine</th>
                  <th className="py-3 px-4 font-semibold">Good Qty</th>
                  <th className="py-3 px-4 font-semibold">Scrap Qty</th>
                  <th className="py-3 px-4 font-semibold">Rework Qty</th>
                  <th className="py-3 px-4 rounded-r-lg font-semibold">
                    Start / End Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 divide-slate-800">
                {(wo.productionLogs || []).map((log: any) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/60 hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {log.operator?.name || "Unassigned Operator"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {log.shift?.name || "Default Shift"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                      {log.machine?.code || "—"}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-400">
                      {log.goodQuantity.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-rose-400 font-semibold">
                      {log.scrapQuantity.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-amber-400 font-semibold">
                      {log.reworkQuantity.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                      {new Date(log.startTime).toLocaleString()}
                      {log.endTime
                        ? ` — ${new Date(log.endTime).toLocaleTimeString()}`
                        : " (Ongoing)"}
                    </td>
                  </tr>
                ))}
                {(wo.productionLogs || []).length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-sm text-slate-400"
                    >
                      No production logs recorded for this Work Order yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* DOWNTIME DURING THIS WO TABLE */}
        <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Downtime during this Work Order
            </h2>
            <span className="text-xs text-slate-400">
              Showing {(wo.downtimeLogs || []).length} downtime events
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs tracking-wider">
                <tr>
                  <th className="py-3 px-4 rounded-l-lg font-semibold">
                    Machine
                  </th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Reason</th>
                  <th className="py-3 px-4 font-semibold">Duration</th>
                  <th className="py-3 px-4 rounded-r-lg font-semibold">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 divide-slate-800">
                {(wo.downtimeLogs || []).map((log: any) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/60 hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                      {log.machine?.code || "—"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-md ${getCategoryBadgeClass(
                          log.reason?.category || "MECHANICAL",
                        )}`}
                      >
                        {log.reason?.category || "MECHANICAL"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {log.reason?.description || "Unspecified Reason"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                      {log.durationMinutes
                        ? `${log.durationMinutes} mins`
                        : "Ongoing..."}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {log.notes || "—"}
                    </td>
                  </tr>
                ))}
                {(wo.downtimeLogs || []).length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-sm text-slate-400"
                    >
                      No downtime recorded during this Work Order.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
