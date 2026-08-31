import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Package } from "lucide-react";
import { getMachineDetailData } from "@/lib/data";
import MachineDetailHeaderClient from "@/app/components/machine/MachineDetailHeaderClient";
import MachineDetailChart from "@/app/components/machine/MachineDetailChart";
import DateRangeBar from "@/app/components/dashboard/DateRangeBar";
import { parseDateRange } from "@/lib/date-utils";
import PrintButton from "@/app/components/print/PrintButton";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export default async function MachineDetailPage(props: {
  params: Promise<{ machineId: string }>;
  searchParams?: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/system/machines/[machineId]");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  const { machineId } = await props.params;
  const searchParams = await props.searchParams;
  const parsedRange = parseDateRange(searchParams || {});

  const [data, shiftCounts] = await Promise.all([
    getMachineDetailData(machineId, parsedRange),
    (prisma as any).shiftCount.findMany({
      where: { machineId },
      include: {
        fromShift: true,
        toShift: true,
        outgoingUser: true,
        incomingUser: true,
      },
      orderBy: { at: "desc" },
      take: 10,
    }),
  ]);

  if (!data || !data.machine) {
    notFound();
  }

  const { machine } = data;
  const downtimeLogs = machine.downtimeLogs || [];
  const oeeEntries = machine.oeeEntries || [];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* BACK NAV & DATE RANGE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-4">
          <Link
            href="/system/admin"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Machine Management
          </Link>
          <div className="flex items-center gap-2">
            <PrintButton />
            <DateRangeBar />
          </div>
        </div>

        {/* HEADER CLIENT WITH LIVE REFRESH */}
        <MachineDetailHeaderClient machine={machine} />

        {/* 7-DAY OEE TREND CHART */}
        <MachineDetailChart
          oeeEntries={oeeEntries}
          machineCode={machine.code}
        />

        {/* SHIFT WIP HANDOFF COUNT HISTORY */}
        <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-500" />
              Shift Handoff WIP Count History
            </h2>
            <span className="text-xs text-slate-400">
              Joint Outgoing vs Incoming Verification ({shiftCounts.length})
            </span>
          </div>

          {shiftCounts.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-4 text-center">
              No shift WIP handoff counts recorded for this machine.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shiftCounts.map((sc: any) => {
                const isAgreed = sc.status === "AGREED";
                const isResolved = sc.status === "RESOLVED";
                const isDisputed = sc.status === "DISPUTED";
                const dateStr = new Date(sc.at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "2-digit",
                });

                return (
                  <div
                    key={sc.id}
                    className="p-4 bg-slate-900 rounded-xl border border-slate-700 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                      <span className="font-bold text-white font-mono">
                        {dateStr} • {sc.fromShift?.name || "Shift"} →{" "}
                        {sc.toShift?.name || "Next Shift"}
                      </span>

                      {isAgreed && (
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 rounded text-[11px] font-bold">
                          {sc.outCount} vs {sc.inCount} ✅ AGREED
                        </span>
                      )}
                      {isResolved && (
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 border border-blue-500/30 rounded text-[11px] font-bold">
                          {sc.outCount} vs {sc.inCount || "—"} ⚠️ RESOLVED (
                          {sc.finalCount})
                        </span>
                      )}
                      {isDisputed && (
                        <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 border border-rose-500/30 rounded text-[11px] font-bold">
                          {sc.outCount} vs {sc.inCount || "—"} ⚠️ DISPUTED
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono">
                      <div>
                        Outgoing ({sc.outgoingUser?.name || "Op 1"}):{" "}
                        <strong>{sc.outCount} pcs</strong>
                      </div>
                      <div>
                        Incoming ({sc.incomingUser?.name || "Op 2"}):{" "}
                        <strong>{sc.inCount ?? "—"} pcs</strong>
                      </div>
                    </div>

                    {sc.note && (
                      <p className="text-[11px] text-slate-400 italic bg-slate-800/60 p-2 rounded border border-slate-700">
                        Resolution Note: {sc.note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* DOWNTIME HISTORY TABLE */}
        <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              Downtime History Logs
            </h2>
            <span className="text-xs text-slate-400">
              Showing all logged events ({downtimeLogs.length})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs tracking-wider">
                <tr>
                  <th className="py-3 px-4 rounded-l-lg font-semibold">
                    Started At
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
                {downtimeLogs.map((event: any) => (
                  <tr
                    key={event.id}
                    className="hover:bg-slate-50/60 hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                      {new Date(event.startTime).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-md ${getCategoryBadgeClass(
                          event.reason?.category || "MECHANICAL",
                        )}`}
                      >
                        {event.reason?.category || "MECHANICAL"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {event.reason?.description || "Unspecified Reason"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                      {event.durationMinutes
                        ? `${event.durationMinutes} mins`
                        : "Ongoing..."}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {event.notes || "—"}
                    </td>
                  </tr>
                ))}
                {downtimeLogs.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-sm text-slate-400"
                    >
                      No downtime events recorded for this machine.
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
