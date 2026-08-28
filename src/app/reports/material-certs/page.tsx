import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

function certTypeLabel(t: string) {
  if (t === "MILL_CERT") return "Mill Cert";
  if (t === "COC") return "Certificate of Conformance";
  if (t === "TEST_REPORT") return "Test Report";
  return t;
}

export default async function MaterialCertsReport() {
  const now = new Date();

  const certs = await (prisma as any).materialCert.findMany({
    include: {
      inventoryTransaction: {
        select: { batchNo: true, qty: true, at: true },
      },
      rawMaterial: {
        select: { name: true, sku: true, unit: true },
      },
      supplier: {
        select: { name: true },
      },
    },
    orderBy: { uploadedAt: "desc" },
  });

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-8 print:mb-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-amber-600 print:hidden" />
          <div>
            <h1 className="text-2xl font-extrabold text-white print:text-black">
              Material Certs & Heat Number Register
            </h1>
            <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
              Generated: {now.toLocaleString()} Â· {certs.length} certifications
              on file
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      <div className="overflow-x-auto bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm print:shadow-none print:border print:border-gray-200 print:rounded-none">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-bold print:bg-gray-100 print:text-gray-700">
            <tr>
              <th className="p-3">Heat Number</th>
              <th className="p-3">Cert Number</th>
              <th className="p-3">Material</th>
              <th className="p-3">Supplier</th>
              <th className="p-3">Batch / Lot</th>
              <th className="p-3">Cert Type</th>
              <th className="p-3">Spec / Grade</th>
              <th className="p-3">Received</th>
              <th className="p-3">Expiry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200 font-mono">
            {certs.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="p-6 text-center text-slate-400 italic font-sans"
                >
                  No certs on file.
                </td>
              </tr>
            )}
            {certs.map((cert: any) => {
              const isExpired =
                cert.expiresAt && new Date(cert.expiresAt) < now;
              return (
                <tr
                  key={cert.id}
                  className={`${isExpired ? "bg-rose-50/50 print:bg-red-50" : "hover:bg-slate-800/90/40"}`}
                >
                  <td className="p-3 font-extrabold text-emerald-400 print:text-green-800">
                    {cert.heatNumber}
                  </td>
                  <td className="p-3 text-slate-600 text-slate-300 print:text-gray-700">
                    {cert.certNumber || "â€”"}
                  </td>
                  <td className="p-3 font-sans">
                    <p className="font-bold text-white print:text-black">
                      {cert.rawMaterial?.name}
                    </p>
                    <p className="text-[10px] text-slate-400 print:text-gray-500">
                      {cert.rawMaterial?.sku}
                    </p>
                  </td>
                  <td className="p-3 font-sans text-slate-600 text-slate-300 print:text-gray-700">
                    {cert.supplier?.name || "â€”"}
                  </td>
                  <td className="p-3 text-slate-400 print:text-gray-600 text-[10px]">
                    {cert.inventoryTransaction?.batchNo || "â€”"}
                  </td>
                  <td className="p-3 text-slate-600 text-slate-300 print:text-gray-700">
                    {certTypeLabel(cert.certType)}
                  </td>
                  <td className="p-3 text-slate-400 print:text-gray-600">
                    {cert.specGrade || "â€”"}
                  </td>
                  <td className="p-3 text-slate-400 print:text-gray-600">
                    {new Date(cert.uploadedAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    {cert.expiresAt ? (
                      <span
                        className={
                          isExpired
                            ? "text-red-600 font-bold"
                            : "text-slate-600 text-slate-300"
                        }
                      >
                        {new Date(cert.expiresAt).toLocaleDateString()}
                        {isExpired ? " âš  EXPIRED" : ""}
                      </span>
                    ) : (
                      <span className="text-slate-400">â€”</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 mt-6 print:mt-4 print:text-gray-400">
        Manufacturing MAX Â· Mill Certs Register Â· Confidential
      </p>
    </main>
  );
}
