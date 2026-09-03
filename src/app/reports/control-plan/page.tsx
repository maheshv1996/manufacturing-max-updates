import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { ListChecks } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ControlPlanPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "quality.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const now = new Date();
  const plans = await prisma.controlPlan.findMany({
    include: { product: { select: { sku: true, name: true } } },
    orderBy: [{ product: { sku: "asc" } }, { processStep: "asc" }],
  });

  const active = plans.filter((p) => p.status === "ACTIVE").length;

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-8 print:mb-4">
        <div className="flex items-center gap-3">
          <ListChecks className="w-7 h-7 text-indigo-600 print:hidden" />
          <div>
            <h1 className="text-2xl font-extrabold text-white print:text-black">
              Control Plan
            </h1>
            <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
              Generated: {now.toLocaleString()} · {plans.length} characteristic
              row(s) · {active} active
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      <div className="overflow-x-auto bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm print:shadow-none print:border print:border-gray-200 print:rounded-none">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-bold print:bg-gray-100 print:text-gray-700">
            <tr>
              <th className="p-3">Plan / Rev</th>
              <th className="p-3">Product</th>
              <th className="p-3">Process Step</th>
              <th className="p-3">Characteristic</th>
              <th className="p-3">Spec</th>
              <th className="p-3">Measurement Method</th>
              <th className="p-3">Sample / Freq</th>
              <th className="p-3">Control Method</th>
              <th className="p-3">Reaction Plan</th>
              <th className="p-3">Responsible</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200">
            {plans.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="p-6 text-center text-slate-400 italic font-sans"
                >
                  No control plan rows on record.
                </td>
              </tr>
            )}
            {plans.map((cp) => (
              <tr key={cp.id} className="align-top">
                <td className="p-3 font-mono font-bold">
                  {cp.planNumber}{" "}
                  <span className="text-slate-400">Rev {cp.revision}</span>
                </td>
                <td className="p-3">
                  {cp.product
                    ? `${cp.product.sku} · ${cp.product.name}`
                    : "—"}
                </td>
                <td className="p-3">{cp.processStep || "—"}</td>
                <td className="p-3 font-medium">{cp.characteristic}</td>
                <td className="p-3 font-mono">
                  {cp.specMin !== null && cp.specMin !== undefined
                    ? `${cp.specMin} – ${cp.specMax ?? "∞"}`
                    : "—"}
                </td>
                <td className="p-3">{cp.measurementMethod || "—"}</td>
                <td className="p-3">
                  {cp.sampleSize ? `${cp.sampleSize} pcs` : ""}
                  {cp.sampleSize && cp.frequency ? " / " : ""}
                  {cp.frequency || ""}
                </td>
                <td className="p-3">{cp.controlMethod || "—"}</td>
                <td className="p-3">{cp.reactionPlan || "—"}</td>
                <td className="p-3">{cp.responsible || "—"}</td>
                <td className="p-3 font-bold">{cp.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 mt-4 print:text-gray-500">
        Manufacturing MAX · Control Plan · IATF 16949 / AS9100 Evidence ·
        Confidential
      </p>
    </main>
  );
}
