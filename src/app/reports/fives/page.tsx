import { prisma } from "@/lib/prisma";
import PrintWrapper from "@/app/components/print/PrintWrapper";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function FiveSReportPage({
  searchParams,
}: {
  searchParams: Promise<{ auditId?: string; mode?: string }>;
}) {
  const resolvedParams = await searchParams;
  const isBlank = resolvedParams.mode === "blank";

  const items = await prisma.fiveSItem.findMany({
    orderBy: [{ category: "asc" }, { seq: "asc" }],
  });

  const audits = await prisma.fiveSAudit.findMany({
    include: { scores: true },
    orderBy: { date: "desc" },
  });

  const selectedAudit = resolvedParams.auditId
    ? audits.find((a) => a.id === resolvedParams.auditId) || audits[0]
    : audits[0];

  const categories = [
    "SORT",
    "SET_IN_ORDER",
    "SHINE",
    "STANDARDIZE",
    "SUSTAIN",
  ] as const;

  return (
    <PrintWrapper
      title={
        isBlank
          ? "5S Audit Checklist (Blank Shopfloor Form)"
          : `5S Audit Report — ${selectedAudit?.area || "Factory Area"}`
      }
      subtitle={
        isBlank
          ? "Physical Audit Sheet for Shopfloor Evaluation"
          : `Auditor: ${selectedAudit?.auditorName || "N/A"} • Score: ${selectedAudit?.totalPct}%`
      }
      controls={
        <div className="flex items-center gap-2">
          {!isBlank ? (
            <Link
              href="/reports/fives?mode=blank"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs font-bold transition-colors"
            >
              Print Blank Form
            </Link>
          ) : (
            <Link
              href="/reports/fives"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs font-bold transition-colors"
            >
              View Audits
            </Link>
          )}
        </div>
      }
    >
      {/* AUDIT SUMMARY HEADER (IF NOT BLANK) */}
      {!isBlank && selectedAudit && (
        <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">
              Audit Area
            </div>
            <div className="text-xl font-black text-slate-900 font-mono">
              📍 {selectedAudit.area}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">
              Audit Score %
            </div>
            <div className="text-2xl font-black text-emerald-600 font-mono">
              {selectedAudit.totalPct}%
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">
              Audit Date
            </div>
            <div className="text-sm font-bold text-slate-800 font-mono">
              {new Date(selectedAudit.date).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}

      {/* BLANK HEADER METRICS (FOR WRITING IN) */}
      {isBlank && (
        <div className="grid grid-cols-3 gap-4 p-4 border-2 border-dashed border-slate-300 rounded-xl text-xs font-bold space-y-1">
          <div>Area Evaluated: ________________________</div>
          <div>Auditor Signature: ______________________</div>
          <div>Date: _________________________________</div>
        </div>
      )}

      {/* CHECKLIST TABLE */}
      <div className="space-y-6">
        {categories.map((catKey) => {
          const catItems = items.filter((i) => i.category === catKey);
          if (catItems.length === 0) return null;

          return (
            <div key={catKey} className="space-y-2">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 border-b-2 border-slate-900 pb-1">
                Category: {catKey}
              </h4>
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-slate-700">
                    <th className="p-2 border-r border-slate-300 w-12 text-center">
                      #
                    </th>
                    <th className="p-2 border-r border-slate-300">
                      Checklist Criterion / Standard
                    </th>
                    <th className="p-2 text-center w-36">Score (1-5)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {catItems.map((item) => {
                    const scoreObj = selectedAudit?.scores?.find(
                      (s) => s.itemId === item.id,
                    );
                    const scoreVal = scoreObj ? scoreObj.score : null;

                    return (
                      <tr key={item.id}>
                        <td className="p-2 border-r border-slate-300 font-mono text-center">
                          {item.seq}
                        </td>
                        <td className="p-2 border-r border-slate-300 font-semibold">
                          {item.text}
                        </td>
                        <td className="p-2 text-center font-mono font-bold text-sm">
                          {isBlank ? (
                            <div className="flex justify-center gap-2 text-slate-400 font-normal">
                              <span>[1]</span> <span>[2]</span> <span>[3]</span>{" "}
                              <span>[4]</span> <span>[5]</span>
                            </div>
                          ) : (
                            <span
                              className={
                                scoreVal && scoreVal >= 4
                                  ? "text-emerald-600 font-bold"
                                  : "text-amber-600 font-bold"
                              }
                            >
                              {scoreVal ? `${scoreVal} / 5` : "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </PrintWrapper>
  );
}
