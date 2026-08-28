import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { ClipboardCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AuditRegisterReport() {
  const now = new Date();
  const audits = await prisma.qmsAudit.findMany({
    orderBy: [{ scheduledDate: "desc" }],
    include: { findings: true },
  });

  const statusColor = (s: string) =>
    s === "COMPLETED"
      ? "bg-emerald-500/10 text-emerald-300 print:bg-gray-200 print:text-black"
      : s === "IN_PROGRESS"
        ? "bg-blue-500/10 text-blue-300 print:bg-gray-200 print:text-black"
        : "bg-slate-500/10 text-slate-300 print:bg-gray-200 print:text-black";

  const allFindings = audits.flatMap((a) => a.findings);
  const openFindings = allFindings.filter((f) => f.status !== "CLOSED");
  const criticalFindings = allFindings.filter((f) => f.severity === "CRITICAL");

  const byStandard = audits.reduce<Record<string, number>>((acc, a) => {
    acc[a.standard] = (acc[a.standard] || 0) + 1;
    return acc;
  }, {});

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-8 print:mb-4">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="w-7 h-7 text-indigo-600 print:hidden" />
          <div>
            <h1 className="text-2xl font-extrabold text-white print:text-black">
              Internal Audit Register
            </h1>
            <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
              Generated: {now.toLocaleString()} Â· {audits.length} audits Â·{" "}
              {openFindings.length} open findings Â· {criticalFindings.length}{" "}
              critical
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 print:grid-cols-4">
        <div className="p-4 rounded-xl border border-slate-600 bg-slate-800/60 shadow-sm print:border-gray-300">
          <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
            Audits
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {audits.length}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-600 bg-slate-800/60 shadow-sm print:border-gray-300">
          <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
            Open Findings
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">
            {openFindings.length}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-600 bg-slate-800/60 shadow-sm print:border-gray-300">
          <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
            Critical
          </div>
          <div className="text-2xl font-black font-mono text-rose-400">
            {criticalFindings.length}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-600 bg-slate-800/60 shadow-sm print:border-gray-300">
          <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
            Standards Covered
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {Object.keys(byStandard).length}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm print:shadow-none print:border print:border-gray-200 print:rounded-none">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-bold print:bg-gray-100 print:text-gray-700">
            <tr>
              <th className="p-3">Audit</th>
              <th className="p-3">Standard</th>
              <th className="p-3">Type</th>
              <th className="p-3">Auditor</th>
              <th className="p-3">Dept</th>
              <th className="p-3">Scheduled</th>
              <th className="p-3">Status</th>
              <th className="p-3">Result</th>
              <th className="p-3 text-right">Findings</th>
              <th className="p-3 text-right">Open</th>
              <th className="p-3 text-right">Critical</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200">
            {audits.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="p-6 text-center text-slate-400 italic"
                >
                  No audits scheduled yet â€” create them in QMS Audits.
                </td>
              </tr>
            )}
            {audits.map((a) => {
              const findings = a.findings || [];
              return (
                <tr key={a.id}>
                  <td className="p-3">
                    <div className="font-extrabold text-white print:text-black">
                      {a.auditNumber}
                    </div>
                    <div className="text-slate-400">{a.title}</div>
                  </td>
                  <td className="p-3 font-mono">{a.standard}</td>
                  <td className="p-3">{a.auditType}</td>
                  <td className="p-3">{a.auditor || "â€”"}</td>
                  <td className="p-3">{a.auditeeDept || "â€”"}</td>
                  <td className="p-3">
                    {new Date(a.scheduledDate).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${statusColor(a.status)}`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="p-3">{a.result || "â€”"}</td>
                  <td className="p-3 text-right font-mono">
                    {findings.length}
                  </td>
                  <td className="p-3 text-right font-mono text-amber-600 print:text-black">
                    {findings.filter((f) => f.status !== "CLOSED").length}
                  </td>
                  <td className="p-3 text-right font-mono text-rose-600 print:text-black">
                    {findings.filter((f) => f.severity === "CRITICAL").length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 mt-6 print:mt-4 print:text-gray-400">
        Manufacturing MAX Â· Internal Audit Register Â· ISO 9001 / AS9100 QMS
        Evidence Â· Confidential
      </p>
    </main>
  );
}
