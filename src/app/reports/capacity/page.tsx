import { getCapacityPlan } from "@/lib/capacityEngine";
import { getSettings } from "@/lib/settings";
import { startOfWeek, parseISO, format, addDays } from "date-fns";
import PrintButton from "@/app/components/print/PrintButton";
import { Calendar } from "lucide-react";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 0;

export default async function CapacityReportPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  let startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
  if (sp?.date) {
    const parsed = new Date(sp.date);
    if (!isNaN(parsed.getTime())) {
      startDate = parsed;
    }
  }

  const { machines } = await getCapacityPlan(startDate, 7);
  const { branding } = await getSettings();
  const dateKeys = Array.from({ length: 7 }).map((_, i) =>
    format(addDays(startDate, i), "yyyy-MM-dd"),
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="bg-slate-800/60 border border-slate-700 p-8 rounded-2xl print:rounded-none print:bg-white print:border-gray-200 print:p-0 shadow-sm print:shadow-none">
        {/* Header */}
        <div className="flex justify-between items-end border-b-2 border-white/15 print:border-slate-900 pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-black text-white print:text-black flex items-center gap-2">
              <Calendar className="w-8 h-8 text-indigo-400 print:text-indigo-600" />
              Weekly Capacity Plan
            </h1>
            <p className="text-slate-400 print:text-slate-600 font-bold mt-1 uppercase tracking-wider">
              {format(startDate, "MMM d")} -{" "}
              {format(addDays(startDate, 6), "MMM d, yyyy")}
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-white print:text-black">
              {branding.companyName || branding.appName}
            </h2>
            <p className="text-slate-400 print:text-slate-600 text-sm">
              Generated: {format(new Date(), "MMM d, yyyy HH:mm")}
            </p>
          </div>
        </div>

        {/* Matrix */}
        <div className="overflow-x-auto mb-8">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-slate-600/60 bg-slate-800/60 p-2 font-bold text-slate-300 print:border-gray-300 print:bg-gray-100 print:text-slate-700 text-left w-48">
                  Machine
                </th>
                {dateKeys.map((dk) => (
                  <th
                    key={dk}
                    className="border border-slate-600/60 bg-slate-800/60 p-2 font-bold text-slate-300 print:border-gray-300 print:bg-gray-100 print:text-slate-700 text-center"
                  >
                    {format(parseISO(dk), "EEE, MMM d")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.machineId}>
                  <td className="border border-slate-600/60 p-2 font-bold text-white print:text-black">
                    {m.machineName}
                    <div className="text-xs font-normal text-slate-400 print:text-slate-600">
                      {m.machineCode}
                    </div>
                  </td>
                  {dateKeys.map((dk) => {
                    const cell = m.days[dk];
                    if (!cell)
                      return (
                        <td
                          key={dk}
                          className="border border-slate-600/60 p-2"
                        />
                      );

                    let bgClass = "print:bg-white";
                    let textClass = "text-slate-200 print:text-slate-900";
                    if (cell.loadPct >= 100) {
                      bgClass = "bg-rose-500/10 print:bg-rose-100";
                      textClass = "text-rose-300 print:text-rose-900 font-bold";
                    } else if (cell.loadPct >= 70) {
                      bgClass = "bg-amber-500/10 print:bg-amber-100";
                      textClass =
                        "text-amber-300 print:text-amber-900 font-bold";
                    }

                    return (
                      <td
                        key={dk}
                        className={`border border-slate-600/60 print:border-gray-300 p-2 align-top ${bgClass} ${textClass}`}
                      >
                        <div className="text-center mb-2">
                          <span className="text-lg font-black">
                            {Math.round(cell.loadPct)}%
                          </span>
                          <div className="text-xs text-slate-400 print:text-slate-600">
                            {cell.loadedHours.toFixed(1)}h /{" "}
                            {cell.availableHours}h
                          </div>
                        </div>

                        {/* WOs if overloaded or heavily loaded */}
                        {cell.contributingWOs.length > 0 &&
                          cell.loadPct >= 70 && (
                            <div className="mt-2 space-y-1 text-xs border-t border-white/10 print:border-slate-300 pt-2">
                              {cell.contributingWOs.map((wo, idx) => (
                                <div
                                  key={idx}
                                  className="flex justify-between gap-1"
                                >
                                  <span className="font-bold truncate">
                                    {wo.woNumber}
                                  </span>
                                  <span>{wo.hours.toFixed(1)}h</span>
                                </div>
                              ))}
                            </div>
                          )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex gap-6 border-t border-white/10 print:border-slate-200 pt-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-transparent border border-white/30 print:bg-white print:border-slate-300"></div>
            <span className="text-sm font-bold text-slate-400 print:text-slate-600">
              &lt; 70% (Underutilized)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-500/20 border border-amber-500/50 print:bg-amber-100 print:border-amber-300"></div>
            <span className="text-sm font-bold text-slate-400 print:text-slate-600">
              70-100% (Optimal)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-rose-500/20 border border-rose-500/50 print:bg-rose-100 print:border-rose-300"></div>
            <span className="text-sm font-bold text-slate-400 print:text-slate-600">
              &gt; 100% (Overloaded)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
