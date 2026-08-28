import { prisma } from "@/lib/prisma";
import PrintWrapper from "@/app/components/print/PrintWrapper";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ShiftReportPage({
  searchParams,
}: {
  searchParams: Promise<{ shiftId?: string; date?: string }>;
}) {
  const resolvedParams = await searchParams;
  const targetDate = resolvedParams.date
    ? new Date(resolvedParams.date)
    : new Date();
  const startOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  const shifts = await prisma.shift.findMany({ where: { isActive: true } });
  const selectedShift = resolvedParams.shiftId
    ? shifts.find((s) => s.id === resolvedParams.shiftId) || shifts[0]
    : shifts[0];

  const handovers = await prisma.shiftHandover.findMany({
    take: 100,
    where: {
      shiftId: selectedShift?.id,
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
    orderBy: { createdAt: "desc" },
  });

  const productionLogs = await prisma.productionLog.findMany({
    take: 100,
    where: {
      startTime: { gte: startOfDay, lte: endOfDay },
      shiftId: selectedShift?.id,
    },
    include: {
      machine: true,
      workOrder: { include: { product: true } },
      operator: true,
    },
  });

  const downtimeLogs = await prisma.downtimeLog.findMany({
    take: 100,
    where: {
      startTime: { gte: startOfDay, lte: endOfDay },
    },
    include: { machine: true, reason: true },
  });

  let shiftGood = 0;
  let shiftScrap = 0;
  productionLogs.forEach((pl) => {
    shiftGood += pl.goodQuantity;
    shiftScrap += pl.scrapQuantity;
  });

  let shiftDowntimeMin = 0;
  downtimeLogs.forEach((dt) => {
    let dur = 0;
    if (dt.endTime)
      dur = Math.round(
        (dt.endTime.getTime() - dt.startTime.getTime()) / (1000 * 60),
      );
    else
      dur = Math.round(
        ((dt.startTime > endOfDay ? endOfDay : new Date()).getTime() -
          dt.startTime.getTime()) /
          (1000 * 60),
      );
    if (dur > 0) shiftDowntimeMin += dur;
  });

  const shiftPlanned = 1000;
  const achievementPct = Number(((shiftGood / shiftPlanned) * 100).toFixed(1));
  const latestMissReason = handovers.find((h) => h.missReason)?.missReason;

  return (
    <PrintWrapper
      title={`Shift Performance & Handover Report — ${selectedShift?.name || "Shift A"}`}
      subtitle={`Date: ${startOfDay.toLocaleDateString()} • Shift Hours: ${selectedShift?.startTime || "06:00"} – ${selectedShift?.endTime || "14:00"}`}
    >
      {/* SHIFT HIGHLIGHTS */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Good Production
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {shiftGood.toLocaleString()} pcs
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Scrap Units
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono">
            {shiftScrap.toLocaleString()} pcs
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Downtime Minutes
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono">
            {shiftDowntimeMin} mins
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            Target Achievement
          </div>
          <div className="text-2xl font-black text-blue-600 font-mono">
            {achievementPct}%
          </div>
        </div>
      </div>

      {/* PLAN VS ACTUAL BAR CHART & MISS REASON */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
        <h4 className="text-xs font-extrabold uppercase text-slate-800">
          Shift Plan vs Actual Output Comparison Chart
        </h4>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs font-bold mb-1">
              <span>Planned Output Target ({shiftPlanned} pcs)</span>
              <span className="font-mono">100%</span>
            </div>
            <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
              <div className="bg-slate-700 h-full w-full" />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold mb-1">
              <span>Actual Good Output Logged ({shiftGood} pcs)</span>
              <span className="font-mono">{achievementPct}%</span>
            </div>
            <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${achievementPct >= 95 ? "bg-emerald-600" : "bg-rose-600"}`}
                style={{ width: `${Math.min(100, achievementPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* BOLD MISS REASON CALLOUT */}
        {latestMissReason ? (
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs text-rose-900 font-bold">
              ⚠️ Miss Reason:{" "}
              <span className="font-black text-slate-900">
                {latestMissReason}
              </span>
            </p>
          </div>
        ) : achievementPct < 95 ? (
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs text-rose-900 font-bold">
              ⚠️ Miss Reason:{" "}
              <span className="font-black text-slate-900">
                Unexplained target variance ({achievementPct}% achieved vs 95%
                target).
              </span>
            </p>
          </div>
        ) : null}
      </div>

      {/* SHIFT HANDOVER NOTES */}
      <div className="space-y-3 pt-2">
        <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 border-b pb-2">
          Supervisor Shift Handover Log Notes
        </h3>
        {handovers.length === 0 ? (
          <p className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-lg border border-slate-200">
            No supervisor handover notes recorded for this shift.
          </p>
        ) : (
          <div className="space-y-3">
            {handovers.map((h) => (
              <div
                key={h.id}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs"
              >
                <div className="flex justify-between font-bold text-slate-900 border-b pb-1">
                  <span>Author / Supervisor: {h.authorName}</span>
                  <span className="font-mono text-slate-500">
                    {new Date(h.createdAt).toLocaleTimeString()}
                  </span>
                </div>

                {h.missReason && (
                  <div className="p-2 bg-rose-100 rounded border border-rose-300 text-rose-900 font-bold">
                    ⚠️ Miss Reason:{" "}
                    <span className="font-black text-slate-900">
                      {h.missReason}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-slate-700">
                  <div>
                    <strong>Safety Notes:</strong>{" "}
                    {h.safetyNotes || "None reported"}
                  </div>
                  <div>
                    <strong>Downtime Notes:</strong>{" "}
                    {h.downtimeNotes || "None reported"}
                  </div>
                </div>
                <div className="text-slate-800 font-medium pt-1">
                  <strong>Production &amp; Next Shift Actions:</strong>{" "}
                  {h.productionNotes ||
                    h.nextShiftActions ||
                    "Shift completed smoothly."}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PrintWrapper>
  );
}
