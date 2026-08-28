import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { ClipboardCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  D1_TEAM: "D1 Team",
  D2_PROBLEM: "D2 Problem",
  D3_CONTAINMENT: "D3 Containment",
  D4_ROOT_CAUSE: "D4 Root Cause",
  D5_CORRECTIVE: "D5 Corrective",
  D6_PREVENTIVE: "D6 Preventive",
  D7_VERIFY: "D7 Verify",
  D8_CLOSURE: "D8 Closure",
  CLOSED: "Closed",
};

export default async function EightDRegisterPage() {
  const now = new Date();
  const reports = await prisma.eightDReport.findMany({
    include: {
      ncr: { select: { ncrNumber: true } },
      product: { select: { sku: true, name: true } },
      workOrder: { select: { woNumber: true } },
      actions: true,
    },
    orderBy: { raisedAt: "desc" },
  });

  const open = reports.filter((r) => r.status !== "CLOSED").length;
  const closed = reports.length - open;

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-8 print:mb-4">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="w-7 h-7 text-blue-600 print:hidden" />
          <div>
            <h1 className="text-2xl font-extrabold text-white print:text-black">
              8D Problem Solving Register
            </h1>
            <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
              Generated: {now.toLocaleString()} Â· {reports.length} report(s) Â·{" "}
              {open} open Â· {closed} closed
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      <div className="overflow-x-auto bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm print:shadow-none print:border print:border-gray-200 print:rounded-none">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-bold print:bg-gray-100 print:text-gray-700">
            <tr>
              <th className="p-3">Report</th>
              <th className="p-3">Title</th>
              <th className="p-3">Linked NCR</th>
              <th className="p-3">Product</th>
              <th className="p-3">Severity</th>
              <th className="p-3">Stage</th>
              <th className="p-3">Root Cause</th>
              <th className="p-3">Actions</th>
              <th className="p-3">Raised</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200">
            {reports.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="p-6 text-center text-slate-400 italic font-sans"
                >
                  No 8D reports on record.
                </td>
              </tr>
            )}
            {reports.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="p-3 font-mono font-bold">{r.reportNumber}</td>
                <td className="p-3 font-medium max-w-[220px]">{r.title}</td>
                <td className="p-3 font-mono">{r.ncr?.ncrNumber || "â€”"}</td>
                <td className="p-3">
                  {r.product ? `${r.product.sku} Â· ${r.product.name}` : "â€”"}
                </td>
                <td className="p-3">{r.severity}</td>
                <td className="p-3">{STATUS_LABELS[r.status] || r.status}</td>
                <td className="p-3 max-w-[220px]">
                  {r.rootCauseSummary || "â€”"}
                </td>
                <td className="p-3">{r.actions?.length || 0}</td>
                <td className="p-3">{r.raisedAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 mt-4 print:text-gray-500">
        Manufacturing MAX Â· 8D / CAPA Register Â· ISO 9001 / AS9100 Evidence Â·
        Confidential
      </p>
    </main>
  );
}
