import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { Ship } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EximReport() {
  const now = new Date();

  const shipments = await prisma.eximShipment.findMany({
    orderBy: { shipmentDate: "desc" },
  });

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-8 print:mb-4">
        <div className="flex items-center gap-3">
          <Ship className="w-7 h-7 text-sky-600 print:hidden" />
          <div>
            <h1 className="text-2xl font-extrabold text-white print:text-black">
              EXIM Shipment Register (Import / Export)
            </h1>
            <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
              Generated: {now.toLocaleString()} Â· {shipments.length}{" "}
              shipment(s) on record
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      <div className="overflow-x-auto bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm print:shadow-none print:border print:border-gray-200 print:rounded-none">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-bold print:bg-gray-100 print:text-gray-700">
            <tr>
              <th className="p-3">Shipment No.</th>
              <th className="p-3">Type</th>
              <th className="p-3">Mode</th>
              <th className="p-3">Incoterm</th>
              <th className="p-3">Port</th>
              <th className="p-3">Invoice</th>
              <th className="p-3">Customer</th>
              <th className="p-3 text-right">Customs Value</th>
              <th className="p-3">Cur.</th>
              <th className="p-3">Date</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200 font-mono">
            {shipments.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="p-6 text-center text-slate-400 italic font-sans"
                >
                  No shipments on record.
                </td>
              </tr>
            )}
            {shipments.map((s) => (
              <tr key={s.id}>
                <td className="p-3 font-extrabold text-white print:text-black">
                  {s.shipmentNumber}
                </td>
                <td className="p-3">{s.shipmentType}</td>
                <td className="p-3">{s.mode}</td>
                <td className="p-3">{s.incoterm}</td>
                <td className="p-3 text-slate-600 text-slate-300 print:text-gray-700">
                  {s.port}
                </td>
                <td className="p-3 text-slate-400 print:text-gray-600">
                  {s.invoiceNumber || "â€”"}
                </td>
                <td className="p-3 font-sans text-slate-600 text-slate-300 print:text-gray-700">
                  {s.customerName || "â€”"}
                </td>
                <td className="p-3 text-right">
                  {s.customsValue.toLocaleString("en-IN")}
                </td>
                <td className="p-3">{s.currency}</td>
                <td className="p-3 text-slate-600 text-slate-300 print:text-gray-700">
                  {new Date(s.shipmentDate).toLocaleDateString()}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-black rounded ${
                      s.status === "DELIVERED" || s.status === "CLEARED"
                        ? "bg-emerald-500/10 text-emerald-300 print:bg-green-50 print:text-green-800"
                        : s.status === "IN_TRANSIT"
                          ? "bg-amber-500/10 text-amber-300 print:bg-amber-50 print:text-amber-800"
                          : "bg-blue-500/10 text-blue-300 print:bg-blue-50 print:text-blue-800"
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 mt-6 print:mt-4 print:text-gray-400">
        Manufacturing MAX Â· EXIM Shipment Register Â· Customs / DGFT Audit
        Evidence Â· Confidential
      </p>
    </main>
  );
}
