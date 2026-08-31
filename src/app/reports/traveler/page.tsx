import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintWrapper from "@/app/components/print/PrintWrapper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function JobTravelerReportPage({
  searchParams,
}: {
  searchParams: Promise<{ workOrderId?: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "ops.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const resolvedParams = await searchParams;

  const workOrders = await prisma.workOrder.findMany({
    include: {
      product: {
        include: {
          routingSteps: {
            include: { operation: true },
            orderBy: { seq: "asc" },
          },
        },
      },
      movementLogs: { orderBy: { at: "desc" } },
      productionLogs: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const selectedWo = resolvedParams.workOrderId
    ? workOrders.find((w) => w.id === resolvedParams.workOrderId) ||
      workOrders[0]
    : workOrders[0];

  const routingSteps = selectedWo?.product?.routingSteps || [];
  const movementLogs = selectedWo?.movementLogs || [];
  const woGood =
    selectedWo?.productionLogs?.reduce((sum, l) => sum + l.goodQuantity, 0) ||
    0;

  return (
    <PrintWrapper
      title={`Work Order Job Traveler Card — ${selectedWo?.woNumber || "WO-0001"}`}
      subtitle={`Product: ${selectedWo?.product?.name || "N/A"} (${selectedWo?.product?.sku || "SKU"}) • Qty: ${selectedWo?.plannedQuantity || 0} pcs`}
    >
      {/* WO HEADER DETAILS */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono">
        <div>
          <span className="text-[10px] text-slate-500 uppercase block font-sans">
            Work Order No
          </span>
          <strong className="text-base text-slate-900">
            {selectedWo?.woNumber}
          </strong>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block font-sans">
            Planned Target Qty
          </span>
          <strong className="text-base text-blue-600">
            {selectedWo?.plannedQuantity} pcs
          </strong>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block font-sans">
            Current Operation Seq
          </span>
          <strong className="text-base text-emerald-600">
            Seq #{selectedWo?.currentSeq || 1}
          </strong>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block font-sans">
            Status
          </span>
          <strong className="text-base text-slate-800">
            {selectedWo?.status}
          </strong>
        </div>
      </div>

      {/* ROUTING OPERATIONS SIGN-OFF SHEET */}
      <div className="space-y-3">
        <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 border-b pb-2">
          Factory Routing Operations &amp; Physical Sign-off Lines
        </h3>
        <table className="w-full text-left text-xs border-collapse border border-slate-300">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-slate-700">
              <th className="p-2.5 border-r border-slate-300 w-12 text-center">
                Seq
              </th>
              <th className="p-2.5 border-r border-slate-300">
                Operation &amp; Code
              </th>
              <th className="p-2.5 border-r border-slate-300">
                Workstation / Bay
              </th>
              <th className="p-2.5 border-r border-slate-300 text-right">
                Cycle Time
              </th>
              <th className="p-2.5 border-r border-slate-300 text-center w-28">
                Good Qty Completed
              </th>
              <th className="p-2.5 border-r border-slate-300 text-center w-28">
                Operator Sign
              </th>
              <th className="p-2.5 text-center w-28">QC Stamp / Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {routingSteps.map((step) => {
              const isCurrent = step.seq === selectedWo?.currentSeq;
              return (
                <tr
                  key={step.id}
                  className={isCurrent ? "bg-blue-50/60 font-bold" : ""}
                >
                  <td className="p-2.5 border-r border-slate-300 font-mono text-center">
                    #{step.seq}
                  </td>
                  <td className="p-2.5 border-r border-slate-300 font-bold">
                    {step.operation?.code} — {step.operation?.name}
                    {step.isHoldPoint && (
                      <div className="mt-1 text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 inline-block rounded font-bold border border-rose-200">
                        ✋ HOLD POINT: {step.holdAuthority || "INSPECTOR"}{" "}
                        SIGN-OFF REQUIRED
                      </div>
                    )}
                  </td>
                  <td className="p-2.5 border-r border-slate-300 font-mono">
                    📍 {step.stationName}
                  </td>
                  <td className="p-2.5 border-r border-slate-300 text-right font-mono">
                    {step.standardCycleTimeSeconds ||
                      step.operation?.defaultCycleTimeSeconds}{" "}
                    sec
                  </td>
                  <td className="p-2.5 border-r border-slate-300 text-center text-slate-400 font-mono">
                    {isCurrent ? `[ ${woGood} pcs ]` : "________"}
                  </td>
                  <td className="p-2.5 border-r border-slate-300 text-center text-slate-400">
                    ________________
                  </td>
                  <td className="p-2.5 text-center text-slate-400">
                    {step.isHoldPoint ? (
                      <div className="border border-rose-300 bg-rose-50/30 p-2 text-[10px] text-rose-700 font-bold rounded">
                        {step.holdAuthority} <br />
                        <br />
                        ______________
                      </div>
                    ) : (
                      "________________"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MATERIAL MOVEMENT LOG HISTORY */}
      {movementLogs.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 border-b pb-2">
            Material Movement Chain of Custody History
          </h3>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-300 font-bold uppercase text-slate-700">
                <th className="p-2.5">Moved At</th>
                <th className="p-2.5">From Station</th>
                <th className="p-2.5">To Station</th>
                <th className="p-2.5 text-right">Quantity</th>
                <th className="p-2.5">Moved By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {movementLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 font-mono">
                  <td className="p-2.5">{new Date(log.at).toLocaleString()}</td>
                  <td className="p-2.5 font-bold">📍 {log.fromStation}</td>
                  <td className="p-2.5 font-bold text-blue-600">
                    📍 {log.toStation}
                  </td>
                  <td className="p-2.5 text-right font-black text-emerald-600">
                    {log.quantity} pcs
                  </td>
                  <td className="p-2.5">{log.movedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PrintWrapper>
  );
}
