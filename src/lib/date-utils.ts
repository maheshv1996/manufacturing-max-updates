export type DateRangePreset =
  "today" | "7d" | "30d" | "90d" | "180d" | "365d" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface ParsedDateRange {
  current: DateRange;
  previous: DateRange;
  preset: DateRangePreset;
}

export function parseDateRange(searchParams: {
  range?: string;
  from?: string;
  to?: string;
}): ParsedDateRange {
  const now = new Date();

  let current: DateRange;
  let previous: DateRange;
  let preset: DateRangePreset = "30d";

  if (searchParams.range) {
    preset = searchParams.range as DateRangePreset;
    let days = 30;

    switch (preset) {
      case "today":
        days = 1;
        break;
      case "7d":
        days = 7;
        break;
      case "30d":
        days = 30;
        break;
      case "90d":
        days = 90;
        break;
      case "180d":
        days = 180;
        break;
      case "365d":
        days = 365;
        break;
      default:
        days = 30;
        preset = "30d";
        break; // Fallback
    }

    const from = new Date(now);
    from.setDate(from.getDate() - days);
    current = { from, to: now };

    const previousFrom = new Date(from);
    previousFrom.setDate(previousFrom.getDate() - days);
    previous = { from: previousFrom, to: from };
  } else if (searchParams.from && searchParams.to) {
    preset = "custom";
    current = {
      from: new Date(searchParams.from),
      to: new Date(searchParams.to),
    };

    // Calculate duration to define previous period
    const durationMs = current.to.getTime() - current.from.getTime();
    previous = {
      from: new Date(current.from.getTime() - durationMs),
      to: current.from,
    };
  } else {
    // Default to 30 days
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    current = { from, to: now };

    const previousFrom = new Date(from);
    previousFrom.setDate(previousFrom.getDate() - 30);
    previous = { from: previousFrom, to: from };
  }

  return { current, previous, preset };
}
