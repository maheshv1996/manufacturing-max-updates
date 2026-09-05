"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export default function ShiftClock() {
  const [timeStr, setTimeStr] = useState<string>("");
  const [shiftName, setShiftName] = useState<string>("Shift 1");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();

      // Determine active industrial factory shift
      if (hours >= 6 && hours < 14) {
        setShiftName("Shift 1");
      } else if (hours >= 14 && hours < 22) {
        setShiftName("Shift 2");
      } else {
        setShiftName("Shift 3 (Night)");
      }

      setTimeStr(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!timeStr) return null;

  return (
    <div
      aria-label={`Current time ${timeStr}, ${shiftName}`}
      className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-xl bg-surface-2/70 border border-border text-xs font-mono"
    >
      <Clock className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
      <span className="text-text-1 font-bold">{timeStr}</span>
      <span className="w-1 h-1 rounded-full bg-border" />
      <span className="text-[10px] font-bold text-accent px-1.5 py-0.5 rounded-md bg-accent/15">
        {shiftName}
      </span>
    </div>
  );
}
