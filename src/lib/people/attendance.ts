import { ok, type Result } from "../core/result";

export type AttendanceLog = {
  userId: string;
  clockIn: Date;
  clockOut: Date | null;
  status: "PRESENT" | "LATE";
};

export type DayClassification = "PRESENT" | "LATE" | "ABSENT";

export type AttendanceStats = {
  presentDays: number;
  lateDays: number;
  absentDays: number;
  workedHours: number;
  otHours: number;
  regularHours: number;
};

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function classifyAttendance(logs: AttendanceLog[]): Result<Map<string, DayClassification>, string> {
  const map = new Map<string, DayClassification>();
  for (const log of logs) {
    const key = dateKey(log.clockIn);
    if (log.clockOut === null) {
      map.set(key, "ABSENT");
    } else {
      map.set(key, log.status === "LATE" ? "LATE" : "PRESENT");
    }
  }
  return ok(map);
}

export function computeAttendance(logs: AttendanceLog[], userId: string, year: number, month: number): Result<AttendanceStats, string> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const filtered = logs.filter((l) => l.userId === userId && l.clockIn >= start && l.clockIn <= end);

  const stats: AttendanceStats = {
    presentDays: 0,
    lateDays: 0,
    absentDays: 0,
    workedHours: 0,
    otHours: 0,
    regularHours: 0,
  };

  const dayMap = new Map<string, AttendanceLog[]>();
  for (const log of filtered) {
    const key = dateKey(log.clockIn);
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(log);
  }

  for (const [, dayLogs] of dayMap) {
    const complete = dayLogs.filter((l) => l.clockOut !== null);
    if (complete.length === 0) {
      stats.absentDays += 1;
      continue;
    }

    const hasLate = dayLogs.some((l) => l.status === "LATE");
    if (hasLate) {
      stats.lateDays += 1;
    } else {
      stats.presentDays += 1;
    }

    const totalMs = complete.reduce((sum, l) => sum + (l.clockOut!.getTime() - l.clockIn.getTime()), 0);
    const hours = totalMs / (1000 * 60 * 60);
    stats.workedHours += hours;
    stats.regularHours += Math.min(hours, 8);
    stats.otHours += Math.max(0, hours - 8);
  }

  return ok(stats);
}
