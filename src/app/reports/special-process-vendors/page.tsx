import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { ShieldCheck } from "lucide-react";
import { computeVendorStatus } from "@/lib/calibration";

export const dynamic = "force-dynamic";

const PROCESS_LABELS: Record<string, string> = {
  HEAT_TREAT: "Heat Treat",
  PLATING: "Plating",
  NDT: "Non-Destructive Testing (NDT)",
  WELDING: "Welding",
  ANODIZE: "Anodize",
};

export default async function SpecialProcessVendorsPage() {
  const now = new Date();

  const vendors = await prisma.specialProcessVendor.findMany({
    orderBy: [{ processType: "asc" }, { name: "asc" }],
  });

  const enriched = vendors.map((v) => ({
    ...v,
    status: computeVendorStatus(v.expiresAt),
  }));

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-8 print:mb-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-blue-600 print:hidden" />
          <div>
            <h1 className="text-2xl font-extrabold text-white print:text-black">
              Approved Special Process Vendors
            </h1>
            <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
              Generated: {now.toLocaleString()} Â· {enriched.length} vendor(s)
              on record Â· Nadcap evidence list
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      <div className="overflow-x-auto bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm print:shadow-none print:border print:border-gray-200 print:rounded-none">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-bold print:bg-gray-100 print:text-gray-700">
            <tr>
              <th className="p-3">Vendor</th>
              <th className="p-3">Special Process</th>
              <th className="p-3">Nadcap Cert Number</th>
              <th className="p-3">Cert Expiry</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200 font-mono">
            {enriched.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="p-6 text-center text-slate-400 italic font-sans"
                >
                  No special process vendors on record.
                </td>
              </tr>
            )}
            {enriched.map((v) => (
              <tr
                key={v.id}
                className={
                  v.status === "EXPIRED"
                    ? "bg-rose-50/50 print:bg-red-50"
                    : "hover:bg-slate-800/90/40"
                }
              >
                <td className="p-3 font-sans font-bold text-white print:text-black">
                  {v.name}
                </td>
                <td className="p-3 font-sans">
                  <span className="px-2 py-0.5 text-[10px] font-black rounded bg-slate-800/60 border border-slate-600 print:border-gray-300 print:bg-gray-100 print:text-gray-700">
                    {PROCESS_LABELS[v.processType] || v.processType}
                  </span>
                </td>
                <td className="p-3 text-slate-600 text-slate-300 print:text-gray-700">
                  {v.nadcapCertNumber || "â€”"}
                </td>
                <td className="p-3 text-slate-600 text-slate-300 print:text-gray-700">
                  {new Date(v.expiresAt).toLocaleDateString()}
                  {v.status === "EXPIRED" ? " âš " : ""}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-black rounded ${
                      v.status === "APPROVED"
                        ? "bg-emerald-500/10 text-emerald-300 print:bg-green-50 print:text-green-800"
                        : "bg-rose-500/10 text-rose-300 print:bg-red-50 print:text-red-800"
                    }`}
                  >
                    {v.status === "APPROVED" ? "APPROVED" : "EXPIRED"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 mt-6 print:mt-4 print:text-gray-400">
        Manufacturing MAX Â· Approved Special Process Vendor List Â· Nadcap
        Audit Evidence Â· Confidential
      </p>
    </main>
  );
}
