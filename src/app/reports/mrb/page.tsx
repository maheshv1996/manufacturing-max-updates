import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { ShieldAlert, Download, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MrbReportPage() {
  const reports = await (prisma as any).ncrReport.findMany({
    include: {
      workOrder: true,
      product: true,
      serialUnit: true,
      defectCode: true,
    },
    orderBy: { raisedAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-rose-500" />
              MRB Register
            </h1>
            <p className="text-xs text-slate-400">
              Log of all Non-Conformance Reports (NCRs) and Dispositions.
            </p>
          </div>
          <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-700">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-extrabold">
                <tr>
                  <th className="py-3 px-4 rounded-l-lg">NCR Number</th>
                  <th className="py-3 px-4">Date Logged</th>
                  <th className="py-3 px-4">WO / Serial</th>
                  <th className="py-3 px-4">Defect</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Disposition</th>
                  <th className="py-3 px-4 rounded-r-lg">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {reports.map((r: any) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-4 px-4 font-bold text-blue-400">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {r.ncrNumber}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-400">
                      {format(new Date(r.raisedAt), "MMM d, yyyy HH:mm")}
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-white block">
                        {r.workOrder?.woNumber}
                      </span>
                      {r.serialUnit && (
                        <span className="text-slate-500 text-[10px]">
                          SN: {r.serialUnit.serialNo}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-rose-400 font-bold">
                      {r.defectCodeId}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          r.severity === "CRITICAL"
                            ? "bg-rose-500/20 text-rose-400"
                            : r.severity === "HIGH"
                              ? "bg-orange-500/20 text-orange-400"
                              : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {r.severity}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-emerald-400">
                      {r.disposition || "PENDING"}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          r.status === "CLOSED"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : r.status === "OPEN"
                              ? "bg-rose-500/20 text-rose-400"
                              : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        {r.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-slate-500 font-sans italic"
                    >
                      No NCR records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
