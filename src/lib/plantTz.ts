// Plant-local calendar offset (default IST, UTC+05:30). Day-window computations for
// the dashboard digest must use the plant's local day, not the server's (Vercel / desktop run on UTC).
export const PLANT_TZ_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Returns plant-local date representation pinned to midnight.
 * Accepts an optional target date and custom offsetMs (defaults to IST).
 */
export function getPlantLocalDate(
  d: Date = new Date(),
  offsetMs: number = PLANT_TZ_OFFSET_MS,
): Date {
  const safeDate = d instanceof Date && !isNaN(d.getTime()) ? d : new Date();
  const plantTimeMs = safeDate.getTime() + offsetMs;
  const dateIsoString = new Date(plantTimeMs).toISOString().slice(0, 10);
  return new Date(`${dateIsoString}T00:00:00.000Z`);
}

/** 
 * "Yesterday" in plant-local time, returned as a Date pinned to the
 * plant-local midnight of that day — safe for startOfDay/endOfDay in
 * digestData regardless of the server's own timezone.
 */
export function getPlantLocalYesterday(
  offsetMs: number = PLANT_TZ_OFFSET_MS,
): Date {
  const plantNow = new Date(Date.now() + offsetMs);
  const plantYesterdayMs = plantNow.getTime() - 24 * 60 * 60 * 1000;
  const dateIsoString = new Date(plantYesterdayMs).toISOString().slice(0, 10);
  return new Date(`${dateIsoString}T00:00:00.000Z`);
}
