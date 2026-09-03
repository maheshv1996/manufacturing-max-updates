import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { Star } from "lucide-react";

export const dynamic = "force-dynamic";

const fmt = (v: number) =>
  Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 1 });
const GRADE_COLOR: Record<string, string> = {
  A: "bg-emerald-500/10 text-emerald-300 print:bg-gray-200 print:text-black",
  B: "bg-blue-500/10 text-blue-300 print:bg-gray-200 print:text-black",
  C: "bg-amber-500/10 text-amber-300 print:bg-gray-200 print:text-black",
  D: "bg-rose-500/10 text-rose-300 print:bg-gray-200 print:text-black",
};

export default async function SupplierScorecardsReport() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "supply.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const now = new Date();
  const cards = await prisma.supplierScorecard.findMany({
    orderBy: [{ period: "desc" }, { overallScore: "desc" }],
  });

  const avg = (k: string) =>
    cards.length
      ? cards.reduce((s, c: any) => s + (c[k] || 0), 0) / cards.length
      : 0;

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-8 print:mb-4">
        <div className="flex items-center gap-3">
          <Star className="w-7 h-7 text-amber-600 print:hidden" />
          <div>
            <h1 className="text-2xl font-extrabold text-white print:text-black">
              Approved Supplier Scorecard Register
            </h1>
            <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
              Generated: {now.toLocaleString()} · {cards.length} scorecards ·
              Weighted: 35% OTD + 35% PPM + 15% cost + 15% responsiveness
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      <div className="overflow-x-auto bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm print:shadow-none print:border print:border-gray-200 print:rounded-none">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-bold print:bg-gray-100 print:text-gray-700">
            <tr>
              <th className="p-3">Supplier</th>
              <th className="p-3">Period</th>
              <th className="p-3 text-right">OTD %</th>
              <th className="p-3 text-right">Quality PPM</th>
              <th className="p-3 text-right">Cost Var %</th>
              <th className="p-3 text-right">Responsiveness</th>
              <th className="p-3 text-right">Overall</th>
              <th className="p-3 text-center">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200 font-mono">
            {cards.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="p-6 text-center text-slate-400 italic font-sans"
                >
                  No supplier scorecards yet.
                </td>
              </tr>
            )}
            {cards.map((c) => (
              <tr key={c.id}>
                <td className="p-3 font-sans font-bold text-white print:text-black">
                  {c.supplierName}
                </td>
                <td className="p-3">{c.period}</td>
                <td className="p-3 text-right">{fmt(c.onTimeDelivery)}</td>
                <td className="p-3 text-right">{fmt(c.qualityPpm)}</td>
                <td
                  className={`p-3 text-right ${c.costVariance > 0 ? "text-rose-600 print:text-black" : ""}`}
                >
                  {c.costVariance > 0 ? "+" : ""}
                  {fmt(c.costVariance)}
                </td>
                <td className="p-3 text-right">{c.responsiveness}/5</td>
                <td className="p-3 text-right font-black text-white print:text-black">
                  {fmt(c.overallScore)}
                </td>
                <td className="p-3 text-center">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-black ${GRADE_COLOR[c.grade] || ""}`}
                  >
                    {c.grade}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          {cards.length > 0 && (
            <tfoot className="bg-slate-800/60 print:bg-gray-100">
              <tr className="font-mono text-xs font-black text-white print:text-black">
                <td colSpan={2} className="p-3 uppercase">
                  Average
                </td>
                <td className="p-3 text-right">{fmt(avg("onTimeDelivery"))}</td>
                <td className="p-3 text-right">{fmt(avg("qualityPpm"))}</td>
                <td className="p-3 text-right">{fmt(avg("costVariance"))}</td>
                <td className="p-3 text-right">{fmt(avg("responsiveness"))}</td>
                <td className="p-3 text-right">{fmt(avg("overallScore"))}</td>
                <td className="p-3"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-[10px] text-slate-400 mt-6 print:mt-4 print:text-gray-400">
        Manufacturing MAX · Supplier Scorecard Register · Supplier Development
        & SQA · Confidential
      </p>
    </main>
  );
}
