import { getDigestData } from "@/lib/digestData";
import { getPlantLocalYesterday } from "@/lib/plantTz";
import DigestClient from "./DigestClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DigestPage(props: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const searchParams = await props.searchParams;
  const dateStr = searchParams?.date;

  // Default to yesterday in plant-local time if no date is provided
  let targetDate = getPlantLocalYesterday();

  if (dateStr) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }

  const digestData = await getDigestData(targetDate);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <DigestClient
          initialData={digestData}
          currentDateStr={targetDate.toISOString().split("T")[0]}
        />
      </div>
    </div>
  );
}
