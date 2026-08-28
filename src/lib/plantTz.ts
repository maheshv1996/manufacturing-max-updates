// Plant-local calendar offset (IST, UTC+05:30). Day-window computations for
// the dashboard digest must use the plant's local day, not the server's
// (Vercel / desktop run on UTC).
export const PLANT_TZ_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** "Yesterday" in plant-local time, returned as a Date pinned to the
 *  plant-local midnight of that day — safe for startOfDay/endOfDay in
 *  digestData regardless of the server's own timezone. */
export function getPlantLocalYesterday(): Date {
  const plantNow = new Date(Date.now() + PLANT_TZ_OFFSET_MS);
  const plantYesterdayMs = plantNow.getTime() - 24 * 60 * 60 * 1000;
  return new Date(new Date(plantYesterdayMs).toISOString().slice(0, 10));
}
