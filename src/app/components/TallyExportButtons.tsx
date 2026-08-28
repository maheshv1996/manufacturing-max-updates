"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileCode, FileSpreadsheet } from "lucide-react";
import { Button } from "@/app/components/ui/Button";

const ALL_TYPES = [
  { key: "INVOICES", label: "Invoices (CSV)" },
  { key: "PAYMENTS", label: "Payments (CSV)" },
  { key: "PAYABLES", label: "Payables (CSV)" },
  { key: "PARTIES", label: "Parties (CSV)" },
];

export default function TallyExportButtons({
  types = ALL_TYPES.map((t) => t.key),
  align = "right",
}: {
  types?: string[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const visible = ALL_TYPES.filter((t) => types.includes(t.key));

  const download = (type: string, format: "csv" | "xml") => {
    setOpen(false);
    // XML exports use the first-class XML_SALES type (returns <ENVELOPE><VOUCHER>).
    window.location.href =
      format === "xml"
        ? "/api/tally/export?type=XML_SALES"
        : `/api/tally/export?type=${type}`;
  };

  return (
    <div
      ref={ref}
      className="relative flex items-center gap-2 print:hidden shrink-0"
    >
      {visible.length > 0 && (
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setOpen((o) => !o)}
          >
            <Download className="w-3.5 h-3.5" />
            Tally Export
            <ChevronDown
              className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </Button>
          {open && (
            <div
              className={`absolute top-full mt-2 z-40 w-52 rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-xl shadow-2xl p-1 ${
                align === "right" ? "right-0" : "left-0"
              }`}
            >
              {visible.map((t) => (
                <button
                  key={t.key}
                  onClick={() => download(t.key, "csv")}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white rounded-lg transition-colors text-left"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => download("XML_SALES", "xml")}
      >
        <FileCode className="w-3.5 h-3.5" />
        Tally XML
      </Button>
    </div>
  );
}
