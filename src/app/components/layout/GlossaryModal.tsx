"use client";

import { useState, useEffect } from "react";
import { BookOpen, Search, X } from "lucide-react";

interface GlossaryTerm {
  term: string;
  category: string;
  definition: string;
  standard?: string;
}

export default function GlossaryModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const GLOSSARY: GlossaryTerm[] = [
    {
      term: "OEE (Overall Equipment Effectiveness)",
      category: "Operations / MES",
      definition:
        "Gold-standard KPI measuring equipment productivity: Availability × Performance Rate × Quality Yield.",
      standard: "ISO 22400",
    },
    {
      term: "AS9102 FAI (First Article Inspection)",
      category: "Aerospace Quality",
      definition:
        "Mandatory aerospace quality standard verifying that manufacturing processes produce parts conforming to engineering drawings across Form 1 (Part Number), Form 2 (Materials & Processes), and Form 3 (Characteristic Dimensions).",
      standard: "SAE AS9102 Rev C",
    },
    {
      term: "Sparkplug B (spBv1.0)",
      category: "IIoT & Telemetry",
      definition:
        "MQTT payload specification defining standard topic namespaces, NBIRTH/DBIRTH certificates, and Report-by-Exception (RBE) data transfer saving over 85% bandwidth.",
      standard: "Eclipse Foundation",
    },
    {
      term: "ISA-95 Unified Namespace (UNS)",
      category: "IIoT Architecture",
      definition:
        "Single source of truth where all industrial sensors, PLC registers, and MES events are published under a standardized hierarchical semantic topic tree (Enterprise / Site / Area / Line / Workcell / Metric).",
      standard: "ISA-95 / IEC 62264",
    },
    {
      term: "MRP (Material Requirements Planning)",
      category: "Supply Chain",
      definition:
        "Algorithm that explodes multi-level Bills of Materials (BOMs) against open work orders and on-hand stock to generate net material requirements and automated purchase requisitions.",
      standard: "APICS / SCM",
    },
    {
      term: "Weibull RUL (Remaining Useful Life)",
      category: "Predictive Maintenance",
      definition:
        "Statistical reliability distribution modeling equipment wear trajectories from vibration RMS and thermal trends to forecast hours before bearing or spindle failure.",
      standard: "ISO 10816 Class II",
    },
    {
      term: "CoC (Certificate of Conformance)",
      category: "Compliance & Traceability",
      definition:
        "Legal manufacturing certificate signed by quality assurance certifying that parts meet all drawing specifications, heat treatment specs, and raw material mill lot certifications.",
      standard: "EN 10204 3.1",
    },
    {
      term: "Subcontracting Delivery Challan (DC)",
      category: "Supply Chain",
      definition:
        "Formal gate pass tracking outward movement of machined parts to third-party vendors for special processes (e.g. Hard Anodizing, Passivation, Heat Treatment) and inward QC return.",
      standard: "GST Section 143",
    },
  ];

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-glossary-modal", handleOpen);
    return () => window.removeEventListener("open-glossary-modal", handleOpen);
  }, []);

  if (!isOpen) return null;

  const filtered = GLOSSARY.filter(
    (g) =>
      g.term.toLowerCase().includes(query.toLowerCase()) ||
      g.category.toLowerCase().includes(query.toLowerCase()) ||
      g.definition.toLowerCase().includes(query.toLowerCase()) ||
      (g.standard && g.standard.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className="bg-surface-1 rounded-3xl shadow-2xl w-full max-w-2xl border border-border overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-text-1">
                Industrial & Aerospace Glossary
              </h3>
              <p className="text-[11px] text-text-3 font-mono">
                Quick reference guide & definitions
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-xl hover:bg-surface-3 text-text-3 hover:text-text-1 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-border bg-surface-2/20 flex items-center gap-2">
          <Search className="w-4 h-4 text-text-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search terms, standards, or acronyms (e.g. AS9102, OEE, Sparkplug)..."
            className="flex-1 bg-transparent border-none outline-none text-xs text-text-1 placeholder:text-text-3"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-text-3 hover:text-text-1 text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {/* Glossary Terms List */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {filtered.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-surface-2/60 border border-border/70 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-text-1">{item.term}</h4>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300">
                  {item.category}
                </span>
              </div>
              <p className="text-xs text-text-3 leading-relaxed">
                {item.definition}
              </p>
              {item.standard && (
                <div className="text-[10px] text-accent font-mono pt-1">
                  Reference Standard:{" "}
                  <span className="text-text-2 font-bold">{item.standard}</span>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-10 text-xs text-text-3">
              No matching acronyms or standards found for &quot;{query}&quot;.
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-border/60 bg-surface-2/40 text-[11px] text-text-3 flex items-center justify-between font-mono">
          <span>Aerospace & Industrial Engineering Reference</span>
          <span>{filtered.length} terms</span>
        </div>
      </div>

      {/* Backdrop */}
      <div
        className="absolute inset-0 z-[-1]"
        onClick={() => setIsOpen(false)}
      />
    </div>
  );
}
