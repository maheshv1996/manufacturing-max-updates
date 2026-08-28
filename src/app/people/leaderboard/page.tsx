import { Trophy } from "lucide-react";
import DateRangeBar from "@/app/components/dashboard/DateRangeBar";
import LeaderboardClient from "./LeaderboardClient";
import { parseDateRange } from "@/lib/date-utils";
import { getLeaderboardData } from "@/lib/leaderboardData";
import { getPlantScope } from "@/lib/plantScope";
import PrintButton from "@/app/components/print/PrintButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LeaderboardPage(props: {
  searchParams?: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const searchParams = await props.searchParams;

  // Default to this month instead of today if range is not provided
  const rangeParams = searchParams || {};
  if (!rangeParams.range && !rangeParams.from) {
    rangeParams.range = "this-month";
  }

  const parsedRange = parseDateRange(rangeParams);
  const plantId = await getPlantScope();
  const leaderboardData = await getLeaderboardData(parsedRange, plantId);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER SECTION */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-700 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-yellow-500 text-white rounded-xl shadow-md shadow-yellow-500/20">
              <Trophy className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Leaderboards
              </h1>
              <p className="text-sm text-slate-400 font-medium">
                Shop Floor Competition & Rankings
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PrintButton />
          </div>
        </header>

        {/* DATE RANGE BAR */}
        <DateRangeBar />

        {/* MAIN CONTENT */}
        <LeaderboardClient data={leaderboardData} />
      </div>
    </div>
  );
}
