import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { format } from "date-fns";
import { ShieldCheck, Activity, AlertTriangle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SerialPassportReport({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "ops.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const { id } = await params;

  const serialUnit = await prisma.serialUnit.findUnique({
    where: { id },
    include: {
      workOrder: true,
      product: true,
      events: {
        orderBy: { at: "asc" },
      },
    },
  });

  if (!serialUnit) notFound();

  return (
    <div className="min-h-screen bg-white text-black p-8 font-sans print:p-0">
      <div className="max-w-4xl mx-auto border border-slate-300 print:border-none p-10 print:p-0">
        {/* Print Controls (hidden when printing) */}
        <div className="mb-8 flex justify-end print:hidden">
          <PrintButton />
        </div>

        {/* Header */}
        <header className="border-b-4 border-slate-900 pb-6 mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">
              Unit Passport
            </h1>
            <h2 className="text-xl font-bold text-slate-500 mt-1">
              Manufacturing Serial Genealogy
            </h2>
          </div>
          <div className="text-right text-sm font-bold">
            <p>Generated: {format(new Date(), "PPpp")}</p>
          </div>
        </header>

        {/* Details Section */}
        <section className="grid grid-cols-2 gap-8 mb-12">
          <div className="space-y-4">
            <div>
              <span className="block text-xs uppercase font-bold text-slate-500 mb-1">
                Serial Number
              </span>
              <span className="text-2xl font-mono font-bold bg-slate-100 px-3 py-1 rounded inline-block">
                {serialUnit.serialNo}
              </span>
            </div>
            <div>
              <span className="block text-xs uppercase font-bold text-slate-500 mb-1">
                Current Status
              </span>
              <span className="text-lg font-bold">{serialUnit.status}</span>
            </div>
            <div>
              <span className="block text-xs uppercase font-bold text-slate-500 mb-1">
                Birth Date
              </span>
              <span className="text-lg font-mono">
                {format(new Date(serialUnit.bornAt), "PPp")}
              </span>
            </div>
          </div>

          <div className="space-y-4 bg-slate-50 p-6 border border-slate-200">
            <div>
              <span className="block text-xs uppercase font-bold text-slate-500 mb-1">
                Product
              </span>
              <span className="text-lg font-bold">
                {serialUnit.product?.name}
              </span>
              <span className="text-sm font-mono block text-slate-600">
                {serialUnit.product?.sku}
              </span>
            </div>
            <div>
              <span className="block text-xs uppercase font-bold text-slate-500 mb-1">
                Work Order
              </span>
              <span className="text-lg font-bold">
                {serialUnit.workOrder?.woNumber}
              </span>
            </div>
          </div>
        </section>

        {/* Event History */}
        <section>
          <h3 className="text-xl font-bold border-b border-slate-300 pb-2 mb-6">
            Genealogy Timeline
          </h3>

          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-200">
            {serialUnit.events?.map((ev: any, _i: number) => (
              <div key={ev.id} className="relative flex items-center group">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white/20 bg-slate-800/60 text-slate-100 shrink-0 shadow-sm z-10">
                  {ev.type === "OPERATION_COMPLETE" ? (
                    <Activity className="w-4 h-4" />
                  ) : ev.type === "INSPECTION" ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : ev.type === "NCR" ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                </div>

                <div className="ml-6 w-full p-4 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {ev.type}
                    </span>
                    <span className="text-xs font-mono font-bold">
                      {format(new Date(ev.at), "PPpp")}
                    </span>
                  </div>
                  <p className="text-base font-semibold mt-1">
                    {ev.description}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    By: {ev.actorName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-slate-300 text-center text-xs text-slate-500">
          <p>This document is an official manufacturing record.</p>
          <p>Generated by Manufacturing MAX MES.</p>
        </footer>
      </div>
    </div>
  );
}
