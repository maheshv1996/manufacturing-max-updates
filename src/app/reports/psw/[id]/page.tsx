import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { FileSignature } from "lucide-react";

export const dynamic = "force-dynamic";

const ELEMENT_STATUS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETE: "Complete",
  N_A: "N/A",
};

export default async function PswPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "quality.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const { id } = await params;
  const sub = await prisma.ppapSubmission.findUnique({
    where: { id },
    include: {
      product: { select: { sku: true, name: true, description: true } },
      elements: { orderBy: { elementNo: "asc" } },
    },
  });

  if (!sub) notFound();

  const now = new Date();
  const complete = sub.elements.filter(
    (e) => e.status === "COMPLETE" || e.status === "N_A",
  ).length;
  const pct = sub.elements.length
    ? Math.round((complete / sub.elements.length) * 100)
    : 0;

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-6 print:mb-4">
        <div className="flex items-center gap-3">
          <FileSignature className="w-7 h-7 text-blue-600 print:hidden" />
          <div>
            <h1 className="text-2xl font-extrabold text-white print:text-black">
              Part Submission Warrant (PSW)
            </h1>
            <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
              Generated: {now.toLocaleString()}
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      {/* Part information */}
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-hidden mb-5 print:border print:border-gray-300 print:rounded-none print:shadow-none">
        <div className="px-5 py-3 bg-slate-800/60 print:bg-gray-100 border-b border-slate-600 print:border-gray-300">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 print:text-gray-700">
            Part Information
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5">
          <Cell label="Supplier" value="Manufacturing Max Industries" />
          <Cell label="Customer" value={sub.customerName || "—"} />
          <Cell label="Part Name" value={sub.product?.name || "—"} />
          <Cell label="Part Number / SKU" value={sub.product?.sku || "—"} />
          <Cell label="Engineering Change Level" value={sub.revision} />
          <Cell
            label="Submission Date"
            value={sub.submittedAt ? sub.submittedAt.toLocaleDateString() : "—"}
          />
          <Cell label="Submission Level" value={String(sub.submissionLevel)} />
          <Cell label="PPAP Number" value={sub.ppapNumber} />
        </div>
      </div>

      {/* Element results */}
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-hidden mb-5 print:border print:border-gray-300 print:rounded-none print:shadow-none">
        <div className="px-5 py-3 bg-slate-800/60 print:bg-gray-100 border-b border-slate-600 print:border-gray-300 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 print:text-gray-700">
            AIAG 18-Element Results
          </h3>
          <span className="text-xs font-bold text-slate-500">
            {complete}/{sub.elements.length} complete ({pct}%)
          </span>
        </div>
        <div className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200">
          {sub.elements.map((el) => (
            <div
              key={el.id}
              className="px-5 py-2 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-800/60 print:bg-gray-100 text-[10px] font-black text-slate-500 shrink-0">
                  {el.elementNo}
                </span>
                <span className="text-sm text-slate-200">{el.elementName}</span>
              </div>
              <span
                className={`shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                  el.status === "COMPLETE"
                    ? "bg-emerald-500/10 text-emerald-600 print:bg-gray-100 print:text-gray-700"
                    : el.status === "N_A"
                      ? "bg-slate-500/10 text-slate-500 print:bg-gray-100 print:text-gray-700"
                      : "bg-amber-500/10 text-amber-600 print:bg-gray-100 print:text-gray-700"
                }`}
              >
                {ELEMENT_STATUS[el.status] || el.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Result + sign-off */}
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-hidden mb-5 print:border print:border-gray-300 print:rounded-none print:shadow-none">
        <div className="px-5 py-3 bg-slate-800/60 print:bg-gray-100 border-b border-slate-600 print:border-gray-300">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 print:text-gray-700">
            Result & Disposition
          </h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { label: "Approved", check: sub.status === "APPROVED" },
              { label: "Approved for Production", check: false },
              { label: "Rejected", check: sub.status === "REJECTED" },
            ].map((opt) => (
              <label
                key={opt.label}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] font-black ${opt.check ? "bg-blue-600 border-blue-600 text-white" : "border-gray-400"}`}
                >
                  {opt.check ? "✓" : ""}
                </span>
                {opt.label}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-6">
            {[
              "Supplier Authorized Representative",
              "Customer Authorized Representative",
            ].map((role) => (
              <div key={role}>
                <div className="h-10 border-b border-dotted border-gray-400" />
                <div className="text-xs text-gray-500 mt-1">
                  {role} — signature, date
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 print:text-gray-500">
        Manufacturing MAX · Part Submission Warrant · AIAG PPAP · Confidential —
        accompanies PPAP {sub.ppapNumber}
      </p>
    </main>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="text-sm font-bold text-white print:text-black mt-0.5">
        {value}
      </div>
    </div>
  );
}
