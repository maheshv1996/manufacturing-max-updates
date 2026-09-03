import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Factory, MapPin, Timer } from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";
import { getMachinesData, getStatsData } from "@/lib/data";
import { getLeaderboardData } from "@/lib/leaderboardData";
import { getDigestData } from "@/lib/digestData";
import { getPlantScope } from "@/lib/plantScope";

import { getPlantLocalYesterday } from "@/lib/plantTz";
import { getSettings } from "@/lib/settings";
import DashboardHeaderClient from "@/app/components/dashboard/DashboardHeaderClient";

import DateRangeBar from "@/app/components/dashboard/DateRangeBar";
import { parseDateRange } from "@/lib/date-utils";
import DashboardClient from "@/app/components/dashboard/DashboardClient";
import { verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { UserPreferences } from "@/lib/userPrefs";
import PrintButton from "@/app/components/print/PrintButton";
import { getCapacityPlan } from "@/lib/capacityEngine";
import { startOfWeek } from "date-fns";

import { calculateWorkOrderCost, getCostingContext } from "@/lib/costingEngine";
import {
  computeCalibrationStatus,
  computeVendorStatus,
} from "@/lib/calibration";
import { getComplianceFlags } from "@/lib/complianceDigest";
import { computeProgramHealth } from "@/lib/programHealth";
import { breachedComplaints } from "@/lib/complaintSla";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export default async function DashboardPage(props: {
  searchParams?: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user || (!user.isOwner && !can(user, "ops.view"))) {
    redirect("/login?redirectTo=/command");
  }

  const searchParams = await props.searchParams;
  const parsedRange = parseDateRange(searchParams || {});
  const plantId = await getPlantScope();

  // Calculate Monthly Financial Performance for "This Month"
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // ── Unified single roundtrip: All dashboard analytics, feeds, & counts in parallel ──
  const [
    { machines, previousMachines },
    { oeeTrends, downtimeByCategory },
    leaderboardData,
    digestData,
    { totalOverloadedDays },
    monthWOs,
    unpaidInvoices,
    energyReadings,
    complianceAlertsRaw,
    monthLogs,
    suppliers,
    rawMaterials,
    complaintCounts,
    ncrCounts,
    settings,
    awaitingInspectorCount,
    pendingEcoCount,
    calibratedToolsDb,
    specialProcessVendorsDb,
    complianceResult,
    programHealth,
    leanObservations,
    openComplaints,
    sessionInfo,
    uncertifiedInBatchCount,
    costingCtx,
  ] = await Promise.all([
    getMachinesData(parsedRange, plantId),
    getStatsData(parsedRange, plantId),
    getLeaderboardData(parsedRange),
    getDigestData(getPlantLocalYesterday()),
    getCapacityPlan(startOfWeek(new Date(), { weekStartsOn: 1 }), 7),
    prisma.workOrder.findMany({
      where: {
        createdAt: { gte: startOfMonth },
        ...(plantId !== "ALL" ? { plantId } : {}),
      },
      include: {
        product: true,
        productionLogs: true,
        inventoryTransactions: { include: { rawMaterial: true } },
      },
    }),
    (prisma as any).invoice.findMany({
      where: {
        status: { in: ["UNPAID", "PARTIAL"] },
      },
      select: {
        totalValue: true,
        paidAmount: true,
        invoiceDate: true,
      },
    }),
    (prisma as any).energyReading.findMany({
      where: { date: { gte: startOfMonth } },
    }),
    (prisma as any).certification.findMany({
      where: {
        isActive: true,
        validUntil: { lt: thirtyDaysFromNow },
      },
      include: {
        user: true,
        machine: true,
      },
      orderBy: { validUntil: "asc" },
    }),
    prisma.productionLog.findMany({
      where: {
        workOrder: {
          createdAt: { gte: startOfMonth },
          ...(plantId !== "ALL" ? { plantId } : {}),
        },
      },
      select: { startTime: true, endTime: true },
    }),
    (prisma as any).supplier.findMany({
      include: {
        purchaseOrders: {
          where: { status: "RECEIVED" },
        },
        payments: true,
      },
    }),
    (prisma as any).rawMaterial.findMany({
      where: {
        isActive: true,
        ...(plantId !== "ALL" ? { plantId } : {}),
      },
      orderBy: { name: "asc" },
    }),
    (prisma as any).customerComplaint.groupBy({
      by: ["severity"],
      where: { status: { not: "CLOSED" } },
      _count: true,
    }),
    (prisma as any).ncrReport.groupBy({
      by: ["status"],
      where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
      _count: true,
    }),
    getSettings(),
    (prisma as any).workOrder.count({
      where: {
        status: "IN_PROGRESS",
        product: {
          routingSteps: {
            some: { isHoldPoint: true },
          },
        },
      },
    }),
    prisma.eco.count({
      where: { status: "DRAFT" },
    }),
    prisma.calibratedTool.findMany(),
    prisma.specialProcessVendor.findMany(),
    getComplianceFlags(now),
    computeProgramHealth(now),
    prisma.leanObservation.findMany({ where: { status: "IMPLEMENTED" } }),
    prisma.customerComplaint.findMany({
      where: { status: { not: "CLOSED" } },
      select: {
        id: true,
        complaintNumber: true,
        customerName: true,
        ackDeadline: true,
        ackAt: true,
        eightDDeadline: true,
        eightDClosedAt: true,
      },
    }),
    (async () => {
      const cookieStore = await cookies();
      const tokenStr = cookieStore.get("app_session")?.value;
      const token = tokenStr ? await verifySessionToken(tokenStr) : null;
      if (!token) return { prefs: null, token: null };
      const u = await prisma.user.findUnique({
        where: { id: token.id },
        select: { prefs: true },
      });
      return { prefs: (u?.prefs as any as UserPreferences) || null, token };
    })(),
    (prisma as any).inventoryTransaction.count({
      where: { type: "IN", materialCert: null },
    }),
    getCostingContext(),
  ]);

  const champion = leaderboardData.operators[0];

  let totalOeeSum = 0;
  let count = 0;
  let totalDowntimeMin = 0;

  machines.forEach((m) => {
    totalOeeSum += m.metrics?.oee || 0;
    count++;
    totalDowntimeMin += m.metrics?.totalDowntimeMin || 0;
  });

  let prevTotalOeeSum = 0;
  let prevCount = 0;
  previousMachines.forEach((m) => {
    prevTotalOeeSum += m.metrics?.oee || 0;
    prevCount++;
  });

  const avgOee = count > 0 ? totalOeeSum / count : 0;
  const prevAvgOee = prevCount > 0 ? prevTotalOeeSum / prevCount : 0;
  const oeeDelta = (avgOee - prevAvgOee).toFixed(1);

  const plantStats = {
    avgOee,
    oeeDelta,
    isOeeUp: avgOee >= prevAvgOee,
    activeCount: machines.filter((m) => m.status === "RUNNING").length,
    totalDowntime: totalDowntimeMin,
    champion: champion
      ? { name: champion.name, score: champion.score }
      : undefined,
    overloadedMachineDays: totalOverloadedDays,
  };

  const { flags: complianceFlags } = complianceResult;
  const atRiskPrograms = programHealth.filter((p: any) => p.risk !== "LOW");
  const highRiskPrograms = programHealth.filter((p: any) => p.risk === "HIGH");
  const slaBreaches = breachedComplaints(openComplaints || [], now);
  const { prefs: initialPrefs, token } = sessionInfo;
  const openComplaintsCount = (complaintCounts as any[]).reduce(
    (s, g) => s + g._count,
    0,
  );
  const criticalComplaintsCount =
    (complaintCounts as any[]).find((g) => g.severity === "CRITICAL")?._count ??
    0;
  const openNcrCount =
    (ncrCounts as any[]).find((g) => g.status === "OPEN")?._count ?? 0;
  const reviewNcrCount =
    (ncrCounts as any[]).find((g) => g.status === "UNDER_REVIEW")?._count ?? 0;
  const ieMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const ieMonthMinutes = leanObservations
    .filter(
      (o: any) => new Date(o.implementedAt || o.observedAt) >= ieMonthStart,
    )
    .reduce((s: number, o: any) => s + o.estMinutesSaved, 0);

  const monthCostings = await Promise.all(
    monthWOs.map((wo) => calculateWorkOrderCost(wo, costingCtx)),
  );
  const monthRevenue = monthCostings.reduce(
    (sum, item) => sum + item.revenue,
    0,
  );
  const monthCost = monthCostings.reduce(
    (sum, item) => sum + item.totalCost,
    0,
  );
  const monthProfit = monthRevenue - monthCost;
  const monthMargin =
    monthRevenue > 0
      ? Number(((monthProfit / monthRevenue) * 100).toFixed(1))
      : 0;

  const financialSummary = {
    revenue: monthRevenue,
    cost: monthCost,
    profit: monthProfit,
    margin: monthMargin,
  };

  // Receivables & Aging Calculation
  const complianceAlerts = complianceAlertsRaw.map((c: any) => ({
    id: c.id,
    operatorName: c.user.name,
    machineCode: c.machine.code,
    validUntil: c.validUntil,
    isExpired: c.validUntil ? c.validUntil < now : false,
  }));
  const monthEnergyTotal = energyReadings.reduce(
    (sum: number, r: any) => sum + r.totalCost,
    0,
  );

  let monthRunHours = 0;
  for (const log of monthLogs) {
    if (log.startTime && log.endTime) {
      monthRunHours += Math.max(
        0.1,
        (new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) /
          3600000,
      );
    }
  }
  const energyPerHr = monthRunHours > 0 ? monthEnergyTotal / monthRunHours : 0;
  const energySummary = {
    totalCost: monthEnergyTotal,
    perMachineHour: energyPerHr,
  };

  const aging = {
    totalOutstanding: 0,
    bucket0_30: 0,
    bucket31_60: 0,
    bucket61_90: 0,
    bucket90Plus: 0,
  };

  unpaidInvoices.forEach((inv: any) => {
    const due = inv.totalValue - (inv.paidAmount || 0);
    if (due <= 0) return;

    aging.totalOutstanding += due;
    const daysOld = Math.floor(
      (now.getTime() - new Date(inv.invoiceDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    if (daysOld <= 30) aging.bucket0_30 += due;
    else if (daysOld <= 60) aging.bucket31_60 += due;
    else if (daysOld <= 90) aging.bucket61_90 += due;
    else aging.bucket90Plus += due;
  });

  const receivablesSummary = aging;

  // Payables Calculation
  const payablesSummary = {
    totalOutstanding: 0,
  };

  suppliers.forEach((s: any) => {
    const purchased = s.purchaseOrders.reduce(
      (sum: number, po: any) => sum + po.receivedQty * po.unitCost,
      0,
    );
    const paid = s.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
    const balance = purchased - paid;
    if (balance > 0) {
      payablesSummary.totalOutstanding += balance;
    }
  });

  const lowStockAlerts = rawMaterials
    .filter((m: any) => m.currentStock <= m.minStock)
    .map((m: any) => ({
      id: m.id,
      sku: m.sku,
      name: m.name,
      unit: m.unit,
      currentStock: m.currentStock,
      minStock: m.minStock,
      unitCost: m.unitCost,
    }));

  const complaintsSummary = {
    openCount: openComplaintsCount,
    criticalCount: criticalComplaintsCount,
  };

  const mrbSummary = {
    openCount: openNcrCount,
    reviewCount: reviewNcrCount,
  };

  // Mill Certs — uncertified IN batches (count fetched in Batch 2; gate on setting)
  const noCertBatchCount = settings.requireMillCerts
    ? uncertifiedInBatchCount
    : 0;

  const calibrationStats = {
    expiredCount: calibratedToolsDb.filter(
      (t) => computeCalibrationStatus(t.expiresAt) === "EXPIRED",
    ).length,
    expiringCount: calibratedToolsDb.filter(
      (t) => computeCalibrationStatus(t.expiresAt) === "EXPIRING_SOON",
    ).length,
  };
  const specialProcessStats = {
    expiredVendorsCount: specialProcessVendorsDb.filter(
      (v) => computeVendorStatus(v.expiresAt) === "EXPIRED",
    ).length,
  };

  // Corporate compliance red-flags — shared engine (also powers the digest API + report)

  return (
    <div className="space-y-8">
      {/* HEADER SECTION */}
      <PageHeader
        title="Manufacturing Max"
        description={
          user?.name
            ? `Good shift, ${user.name.split(" ")[0]}  Enterprise MES & Lean Six Sigma Platform`
            : "Enterprise MES & Lean Six Sigma Platform"
        }
        icon={<Factory className="w-7 h-7 text-accent" />}
      >
        <div className="flex items-center gap-3">
          <PrintButton />
          <DashboardHeaderClient machines={machines} />
        </div>
      </PageHeader>

      {/* M8  EXEC STRIP: customer SLA breaches (24h ack / 10d 8D) */}
      {slaBreaches.length > 0 && (
        <div className="bg-orange-950/40 border-2 border-orange-600/60 rounded-2xl p-4 shadow-[0_0_24px_rgba(234,88,12,0.15)]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-900/60 text-orange-400 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-orange-300">
                Customer SLA {slaBreaches.length} breached
              </h3>
              <div className="mt-2 space-y-1.5">
                {slaBreaches.map((c: any) => (
                  <a
                    key={c.id}
                    href="/complaints"
                    className="flex items-center gap-2 text-xs text-orange-200/90 hover:text-white group"
                  >
                    <span className="font-mono font-bold text-orange-300 group-hover:text-white">
                      {c.complaintNumber}
                    </span>
                    <span className="truncate">{c.customerName}</span>
                    {c.sla.ackBreached && (
                      <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded bg-orange-600 text-white">
                        ACK OVERDUE
                      </span>
                    )}
                    {c.sla.eightDBreached && (
                      <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white">
                        8D OVERDUE
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>
            <span className="hidden md:block text-[10px] font-bold uppercase tracking-wider text-orange-400/60 shrink-0">
              SLA 24H / 10D
            </span>
          </div>
        </div>
      )}

      {/* P29  EXEC RED STRIP: at-risk programs demand attention */}
      {atRiskPrograms.length > 0 && (
        <div className="bg-rose-950/40 border-2 border-rose-700/60 rounded-2xl p-4 shadow-[0_0_24px_rgba(225,29,72,0.15)]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-900/60 text-rose-400 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-rose-300">
                Program Health{" "}
                {highRiskPrograms.length > 0
                  ? `${highRiskPrograms.length} at risk`
                  : "monitor closely"}
              </h3>
              <div className="mt-2 space-y-1.5">
                {atRiskPrograms.map((p: any) => (
                  <a
                    key={p.projectId}
                    href="/projects"
                    className="flex items-center gap-2 text-xs text-rose-200/90 hover:text-white group"
                  >
                    <span className="font-mono font-bold text-rose-300 group-hover:text-white">
                      {p.code}
                    </span>
                    <span className="truncate">
                      {p.name} {p.clientName}
                    </span>
                    {p.risk === "HIGH" && (
                      <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white">
                        {p.overdueWos.length} WO SLIPPED
                        {p.slippedMilestones.length
                          ? `  ${p.slippedMilestones.length} MILESTONE`
                          : ""}
                      </span>
                    )}
                    {p.risk === "MEDIUM" && (
                      <span className="shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-black">
                        DUE SOON
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>
            <span className="hidden md:block text-[10px] font-bold uppercase tracking-wider text-rose-400/60 shrink-0">
              Sales owner notified via bell
            </span>
          </div>
        </div>
      )}

      {/* M4  IE savings strip */}
      {ieMonthMinutes > 0 && (
        <div className="bg-emerald-950/30 border border-emerald-700/40 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-emerald-900/50 text-emerald-400 rounded-lg">
            <Timer className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
              IE & Lean savings this month
            </span>
            <span className="text-sm font-black text-emerald-200 ml-2">
              {ieMonthMinutes} minutes{" "}
              {Math.round((ieMonthMinutes / 60) * 10) / 10}h of operator time
              recovered
            </span>
          </div>
          <a
            href="/ops/ie-observations"
            className="text-xs font-bold text-emerald-300 hover:text-white shrink-0"
          >
            Open log ?
          </a>
        </div>
      )}

      {/* DATE RANGE BAR */}
      <DateRangeBar />

      {plantId === "ALL" && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-400 rounded-lg">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-blue-100">All Plants View</h3>
              <p className="text-sm text-blue-300">
                You are viewing aggregated data across all manufacturing
                facilities.
              </p>
            </div>
          </div>
          <Link
            href="/people/leaderboard?tab=plants"
            className="px-4 py-2 bg-slate-800/60 text-blue-400 text-sm font-bold border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 hover:bg-blue-900/20 transition-colors shadow-sm"
          >
            Compare Plants
          </Link>
        </div>
      )}

      <DashboardClient
        machines={machines}
        plantStats={plantStats}
        champion={champion}
        digestData={digestData}
        oeeTrends={oeeTrends}
        downtimeByCategory={downtimeByCategory}
        initialPrefs={initialPrefs}
        userRole={token?.roleName || "ADMIN"}
        userId={token?.id}
        financialSummary={financialSummary}
        receivablesSummary={receivablesSummary}
        payablesSummary={payablesSummary}
        lowStockAlerts={lowStockAlerts}
        energySummary={energySummary}
        complianceAlerts={complianceAlerts}
        complaintsSummary={complaintsSummary}
        mrbSummary={mrbSummary}
        noCertBatchCount={noCertBatchCount}
        awaitingInspectorCount={awaitingInspectorCount}
        pendingEcoCount={pendingEcoCount}
        calibrationStats={calibrationStats}
        specialProcessStats={specialProcessStats}
        complianceFlags={complianceFlags}
      />
    </div>
  );
}
