import {
  startOfDay,
  endOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subYears,
  isValid,
} from "date-fns";

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "180d"
  | "365d"
  | "mtd"
  | "qtd"
  | "ytd"
  | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface ParsedDateRange {
  current: DateRange;
  previous: DateRange;
  preset: DateRangePreset;
}

export interface DateRangeOptions {
  range?: string;
  from?: string | Date;
  to?: string | Date;
  /** Optional custom reference point (defaults to new Date()) */
  referenceDate?: Date;
}

/**
 * Universal Date Range Parser for Factory Analytics & Dashboards.
 * Robust against timezone anomalies, invalid search param strings, intraday timestamps,
 * and inverted custom date ranges.
 */
export function parseDateRange(searchParams: DateRangeOptions): ParsedDateRange {
  const now = searchParams.referenceDate && isValid(searchParams.referenceDate)
    ? new Date(searchParams.referenceDate)
    : new Date();

  // 1. Custom Date Range Handling
  if (searchParams.from || searchParams.to) {
    const rawFrom = searchParams.from ? new Date(searchParams.from) : undefined;
    const rawTo = searchParams.to ? new Date(searchParams.to) : undefined;

    const validFrom = rawFrom && isValid(rawFrom) ? rawFrom : undefined;
    const validTo = rawTo && isValid(rawTo) ? rawTo : undefined;

    if (validFrom || validTo) {
      let from = validFrom || startOfDay(validTo || now);
      let to = validTo || endOfDay(validFrom || now);

      // Universal inverted date protection
      if (from.getTime() > to.getTime()) {
        const temp = from;
        from = to;
        to = temp;
      }

      // Check if both dates are date-only (00:00:00 to 00:00:00)
      const isDateOnlyFrom = from.getHours() === 0 && from.getMinutes() === 0 && from.getSeconds() === 0 && from.getMilliseconds() === 0;
      const isDateOnlyTo = to.getHours() === 0 && to.getMinutes() === 0 && to.getSeconds() === 0 && to.getMilliseconds() === 0;

      if (isDateOnlyFrom) {
        from = startOfDay(from);
      }
      if (isDateOnlyTo || to.getTime() === from.getTime()) {
        to = endOfDay(to);
      }

      const diffMs = to.getTime() - from.getTime();
      const durationMs = Math.max(1000 * 60, diffMs > 0 ? diffMs : 1000 * 60 * 60 * 24);

      const previous: DateRange = {
        from: new Date(from.getTime() - durationMs),
        to: new Date(from.getTime()),
      };

      return {
        current: { from, to },
        previous,
        preset: "custom",
      };
    }
  }

  // 2. Preset Range Handling
  const presetKey = String(searchParams.range || "30d").toLowerCase() as DateRangePreset;

  switch (presetKey) {
    case "today": {
      const from = startOfDay(now);
      const to = now;
      const yesterdayFrom = startOfDay(subDays(now, 1));
      const yesterdayTo = endOfDay(subDays(now, 1));
      return {
        current: { from, to },
        previous: { from: yesterdayFrom, to: yesterdayTo },
        preset: "today",
      };
    }

    case "yesterday": {
      const from = startOfDay(subDays(now, 1));
      const to = endOfDay(subDays(now, 1));
      const prevFrom = startOfDay(subDays(now, 2));
      const prevTo = endOfDay(subDays(now, 2));
      return {
        current: { from, to },
        previous: { from: prevFrom, to: prevTo },
        preset: "yesterday",
      };
    }

    case "mtd": {
      const from = startOfMonth(now);
      const to = now;
      const prevFrom = startOfMonth(subMonths(now, 1));
      const prevTo = endOfDay(subDays(from, 1));
      return {
        current: { from, to },
        previous: { from: prevFrom, to: prevTo },
        preset: "mtd",
      };
    }

    case "qtd": {
      const from = startOfQuarter(now);
      const to = now;
      const prevFrom = startOfQuarter(subQuarters(now, 1));
      const prevTo = endOfDay(subDays(from, 1));
      return {
        current: { from, to },
        previous: { from: prevFrom, to: prevTo },
        preset: "qtd",
      };
    }

    case "ytd": {
      const from = startOfYear(now);
      const to = now;
      const prevFrom = startOfYear(subYears(now, 1));
      const prevTo = endOfDay(subDays(from, 1));
      return {
        current: { from, to },
        previous: { from: prevFrom, to: prevTo },
        preset: "ytd",
      };
    }

    case "7d":
    case "30d":
    case "90d":
    case "180d":
    case "365d":
    default: {
      const dayMap: Record<string, number> = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "180d": 180,
        "365d": 365,
      };
      const days = dayMap[presetKey] || 30;
      const activePreset: DateRangePreset = dayMap[presetKey] ? (presetKey as DateRangePreset) : "30d";

      const from = startOfDay(subDays(now, days));
      const to = now;
      const prevFrom = startOfDay(subDays(from, days));
      const prevTo = from;

      return {
        current: { from, to },
        previous: { from: prevFrom, to: prevTo },
        preset: activePreset,
      };
    }
  }
}

/**
 * Checks if a given timestamp falls within a DateRange.
 */
export function isWithinDateRange(date: Date | string | number, range: DateRange): boolean {
  const t = new Date(date).getTime();
  return !isNaN(t) && t >= range.from.getTime() && t <= range.to.getTime();
}
