import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GatePassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "supply.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const { id } = await params;
  const dispatch = await prisma.dispatchRecord.findUnique({
    where: { id },
    include: { workOrder: { include: { product: true, invoices: true } } },
  });
  if (!dispatch) notFound();

  const wo = dispatch.workOrder;
  const invoice = wo?.invoices?.[0];
  const dt = (v: Date | null | undefined) =>
    v ? new Date(v).toLocaleDateString("en-IN") : "—";
  const time = dispatch.dispatchedAt.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-6 print:mb-4">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h1 className="text-lg font-semibold text-slate-100">
            Gate Pass — {dispatch.gatePassNumber || dispatch.challanNumber}
          </h1>
        </div>
        <PrintButton />
      </div>

      <div className="bg-white text-slate-900 rounded-lg shadow-lg p-8 print:shadow-none print:rounded-none print:p-0 space-y-6">
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div>
            <div className="text-xl font-bold uppercase tracking-wide">
              Manufacturing Max
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              Gate Pass · Dispatch Authority
            </div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div className="font-semibold text-sm text-slate-900">
              {dispatch.gatePassNumber}
            </div>
            <div>{dispatch.challanNumber}</div>
            <div>
              {dt(dispatch.dispatchedAt)} {time}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <span className="text-slate-500">Work Order:</span>{" "}
            <span className="font-bold">{wo?.woNumber || "—"}</span>
          </div>
          <div>
            <span className="text-slate-500">Product:</span>{" "}
            <span className="font-bold">{wo?.product?.name || "—"}</span>
          </div>
          <div>
            <span className="text-slate-500">Customer:</span>{" "}
            {wo?.customerName || "—"}
          </div>
          <div>
            <span className="text-slate-500">Quantity:</span>{" "}
            <span className="font-bold">{dispatch.dispatchedQty} pcs</span>
          </div>
          {invoice && (
            <div>
              <span className="text-slate-500">Invoice:</span>{" "}
              {invoice.invoiceNumber}
            </div>
          )}
          <div>
            <span className="text-slate-500">Carrier:</span>{" "}
            {dispatch.carrierName || "—"}
          </div>
          <div>
            <span className="text-slate-500">Vehicle No.:</span>{" "}
            <span className="font-black">{dispatch.vehicleNumber}</span>
          </div>
          <div>
            <span className="text-slate-500">Driver:</span>{" "}
            <span className="font-black">{dispatch.driverName}</span>
          </div>
          <div>
            <span className="text-slate-500">E-way Bill (GST):</span>{" "}
            <span className="font-black">{dispatch.ewayBillNo}</span>
          </div>
          <div>
            <span className="text-slate-500">Prepared by:</span>{" "}
            {dispatch.dispatchedByName}
          </div>
          {dispatch.notes && (
            <div className="col-span-2">
              <span className="text-slate-500">Notes:</span> {dispatch.notes}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6 pt-8">
          <div>
            <div className="border-t border-slate-400 pt-1 text-xs text-slate-500">
              Prepared by (Despatch)
            </div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-1 text-xs text-slate-500">
              Security check ({dispatch.securityCheckedBy || "Security"})
            </div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-1 text-xs text-slate-500">
              Receiver (Gate)
            </div>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 border-t border-slate-300 pt-3">
          This gate pass authorises the release of the above material from the
          factory premises. Valid only with vehicle, driver and e-way bill
          details recorded above. For GST compliance, the e-way bill number is
          mandatory for taxable supply movement.
        </p>
      </div>
    </main>
  );
}
