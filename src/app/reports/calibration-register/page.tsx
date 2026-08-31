import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { Gauge } from "lucide-react";
import { computeCalibrationStatus } from "@/lib/calibration";

export const dynamic = "force-dynamic";

const TOOL_TYPE_LABELS: Record<string, string> = {
  GAUGE: "Gauge",
  TORQUE_WRENCH: "Torque Wrench",
  CMM: "CMM",
  MICROMETER: "Micrometer",
};

export default async function CalibrationRegisterPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "quality.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const now = new Date();

  const tools = await prisma.calibratedTool.findMany({
    orderBy: [{ status: "asc" }, { expiresAt: "asc" }],
  });

  const enriched = tools.map((t) => ({
    ...t,
    status: computeCalibrationStatus(t.expiresAt),
  }));

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-8 print:mb-4">
        <div className="flex items-center gap-3">
          <Gauge className="w-7 h-7 text-teal-600 print:hidden" />
          <div>
            <h1 className="text-2xl font-extrabold text-white print:text-black">
              Calibration Register
            </h1>
            <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
              Generated: {now.toLocaleString()} Â· {enriched.length} calibrated
              tool(s) on record
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      <div className="overflow-x-auto bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm print:shadow-none print:border print:border-gray-200 print:rounded-none">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-bold print:bg-gray-100 print:text-gray-700">
            <tr>
              <th className="p-3">Tool Type</th>
              <th className="p-3">Tool</th>
              <th className="p-3">Serial Number</th>
              <th className="p-3">Cert Number</th>
              <th className="p-3">Calibrated</th>
              <th className="p-3">Expiry</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200 font-mono">
            {enriched.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-slate-400 italic font-sans"
                >
                  No calibrated tools on record.
                </td>
              </tr>
            )}
            {enriched.map((t) => (
              <tr
                key={t.id}
                className={
                  t.status === "EXPIRED"
                    ? "bg-rose-50/50 print:bg-red-50"
                    : t.status === "EXPIRING_SOON"
                      ? "bg-amber-50/40 print:bg-amber-50"
                      : "hover:bg-slate-800/90/40"
                }
              >
                <td className="p-3 font-sans">
                  <span className="px-2 py-0.5 text-[10px] font-black rounded bg-slate-800/60 border border-slate-600 print:border-gray-300 print:bg-gray-100 print:text-gray-700">
                    {TOOL_TYPE_LABELS[t.toolType] || t.toolType}
                  </span>
                </td>
                <td className="p-3 font-sans font-bold text-white print:text-black">
                  {t.name}
                </td>
                <td className="p-3 text-slate-600 text-slate-300 print:text-gray-700">
                  {t.serialNumber}
                </td>
                <td className="p-3 text-slate-400 print:text-gray-600">
                  {t.certNumber || "â€”"}
                </td>
                <td className="p-3 text-slate-400 print:text-gray-600">
                  {new Date(t.calibratedAt).toLocaleDateString()}
                </td>
                <td className="p-3 text-slate-600 text-slate-300 print:text-gray-700">
                  {new Date(t.expiresAt).toLocaleDateString()}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-black rounded ${
                      t.status === "OK"
                        ? "bg-emerald-500/10 text-emerald-300 print:bg-green-50 print:text-green-800"
                        : t.status === "EXPIRING_SOON"
                          ? "bg-amber-500/10 text-amber-300 print:bg-amber-50 print:text-amber-800"
                          : "bg-rose-500/10 text-rose-300 print:bg-red-50 print:text-red-800"
                    }`}
                  >
                    {t.status === "OK"
                      ? "OK"
                      : t.status === "EXPIRING_SOON"
                        ? "EXPIRING"
                        : "EXPIRED"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 mt-6 print:mt-4 print:text-gray-400">
        Manufacturing MAX Â· Calibration Register Â· AS9100 / Nadcap Evidence Â·
        Confidential
      </p>
    </main>
  );
}
