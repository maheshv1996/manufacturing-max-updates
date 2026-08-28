import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import PrintButton from "@/app/components/print/PrintButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ComplaintsRegisterReport() {
  const complaints = await prisma.customerComplaint.findMany({
    orderBy: { raisedAt: "desc" },
    include: {
      workOrder: {
        select: { woNumber: true },
      },
    },
  });

  return (
    <div className="max-w-5xl mx-auto p-8 min-h-screen text-white print:text-black print:bg-white">
      <div className="flex justify-between items-start mb-8 border-b border-white/15 print:border-gray-300 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-white print:text-gray-900">
            Complaints Register
          </h1>
          <p className="text-slate-400 print:text-gray-500 mt-1">
            Generated {format(new Date(), "PPpp")}
          </p>
        </div>
        <div className="print:hidden">
          <PrintButton />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4 bg-slate-800/60 p-4 rounded-lg border border-white/10 print:bg-gray-50 print:border-gray-200">
        <div>
          <p className="text-sm text-slate-400 print:text-gray-500 font-medium">
            Total Complaints
          </p>
          <p className="text-2xl font-bold text-white print:text-gray-900">
            {complaints.length}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-400 print:text-gray-500 font-medium">
            Open / Active
          </p>
          <p className="text-2xl font-bold text-rose-400 print:text-rose-600">
            {complaints.filter((c) => c.status !== "CLOSED").length}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-400 print:text-gray-500 font-medium">
            Critical Severity
          </p>
          <p className="text-2xl font-bold text-amber-400 print:text-orange-600">
            {complaints.filter((c) => c.severity === "CRITICAL").length}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-400 print:text-gray-500 font-medium">
            Closed
          </p>
          <p className="text-2xl font-bold text-emerald-400 print:text-emerald-600">
            {complaints.filter((c) => c.status === "CLOSED").length}
          </p>
        </div>
      </div>

      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-white/15 bg-slate-800/60 print:border-gray-300 print:bg-gray-100">
            <th className="py-3 px-4 font-bold text-slate-300 print:text-gray-700">
              ID / Date
            </th>
            <th className="py-3 px-4 font-bold text-slate-300 print:text-gray-700">
              Customer & Trace
            </th>
            <th className="py-3 px-4 font-bold text-slate-300 print:text-gray-700">
              Type / Sev.
            </th>
            <th className="py-3 px-4 font-bold text-slate-300 print:text-gray-700">
              Description
            </th>
            <th className="py-3 px-4 font-bold text-slate-300 print:text-gray-700">
              Status & CAPA
            </th>
          </tr>
        </thead>
        <tbody>
          {complaints.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="py-8 text-center text-slate-400 border-b border-white/10 print:border-gray-200"
              >
                No complaints recorded in the system.
              </td>
            </tr>
          ) : (
            complaints.map((c) => (
              <tr
                key={c.id}
                className="border-b border-white/10 print:border-gray-200 hover:bg-white/5 print:hover:bg-white break-inside-avoid"
              >
                <td className="py-3 px-4 align-top">
                  <div className="font-medium text-white print:text-gray-900">
                    {c.complaintNumber}
                  </div>
                  <div className="text-xs text-slate-400 print:text-gray-500 mt-1">
                    {format(new Date(c.raisedAt), "MMM d, yyyy")}
                  </div>
                </td>
                <td className="py-3 px-4 align-top">
                  <div className="font-semibold">{c.customerName}</div>
                  {c.workOrder && (
                    <div className="text-xs text-blue-400 print:text-blue-600 mt-1 uppercase tracking-wider">
                      WO: {c.workOrder.woNumber}
                    </div>
                  )}
                  {c.batchNo && (
                    <div className="text-xs text-slate-400 print:text-gray-500 mt-0.5">
                      Batch: {c.batchNo}
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 align-top">
                  <div>{c.type}</div>
                  <div
                    className={`text-xs mt-1 font-bold ${
                      c.severity === "CRITICAL"
                        ? "text-rose-400 print:text-rose-600"
                        : c.severity === "HIGH"
                          ? "text-amber-400 print:text-orange-600"
                          : c.severity === "MEDIUM"
                            ? "text-amber-300 print:text-amber-600"
                            : "text-blue-400 print:text-blue-600"
                    }`}
                  >
                    {c.severity}
                  </div>
                </td>
                <td className="py-3 px-4 align-top max-w-xs">
                  <div className="text-slate-300 print:text-gray-700 whitespace-pre-wrap">
                    {c.description}
                  </div>
                  {c.returnedQty && (
                    <div className="mt-2 text-xs text-slate-400 print:text-gray-500">
                      Returned Qty: <strong>{c.returnedQty}</strong>
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 align-top max-w-xs">
                  <div
                    className={`font-bold mb-2 ${c.status === "CLOSED" ? "text-emerald-400 print:text-emerald-600" : "text-rose-400 print:text-rose-600"}`}
                  >
                    {c.status}
                  </div>
                  {c.status === "CLOSED" && c.capaAction && (
                    <>
                      <div className="text-xs font-semibold text-slate-400 print:text-gray-500">
                        Root Cause:
                      </div>
                      <div className="text-xs text-slate-300 print:text-gray-700 mb-1">
                        {c.rootCause}
                      </div>
                      <div className="text-xs font-semibold text-slate-400 print:text-gray-500 mt-2">
                        CAPA:
                      </div>
                      <div className="text-xs text-slate-300 print:text-gray-700">
                        {c.capaAction}
                      </div>
                      <div className="text-xs text-emerald-400 print:text-emerald-700 mt-2 font-medium">
                        Disposition: {c.disposition}
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
