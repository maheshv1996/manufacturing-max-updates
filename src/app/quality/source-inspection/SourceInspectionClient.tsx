"use client";

import { useState, useEffect } from "react";
import {
  Stamp,
  FileCheck,
  Plus,
  Clock,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";

interface WitnessTest {
  name: string;
  status: string;
  cert: string;
}

interface SourceInspection {
  id: string;
  agency: string;
  agencyFull: string;
  inspectorName: string;
  workOrderNumber: string;
  partNumber: string;
  partName: string;
  heatNumber: string;
  batchQty: number;
  inspectedQty: number;
  passedQty: number;
  status: string;
  witnessedTests: WitnessTest[];
  stampNumber: string;
  clearanceDate: string | null;
  remarks: string;
}

export default function SourceInspectionClient() {
  const [inspections, setInspections] = useState<SourceInspection[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<SourceInspection | null>(null);

  // Form State
  const [agency, setAgency] = useState("DGAQA");
  const [inspectorName, setInspectorName] = useState("");
  const [workOrderNumber, setWorkOrderNumber] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [heatNumber, setHeatNumber] = useState("");
  const [batchQty, setBatchQty] = useState(10);
  const [stampNumber, setStampNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    fetch("/api/quality/source-inspection")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setInspections(data.inspections);
          if (data.inspections.length > 0) setSelectedInspection(data.inspections[0]);
        }
      })
      .catch(() => {});
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectorName || !workOrderNumber || !partNumber) {
      toast.error("Please fill in inspector, work order and part number");
      return;
    }

    const newRecord: SourceInspection = {
      id: "CSI-2026-" + Math.floor(100 + Math.random() * 900),
      agency,
      agencyFull: agency === "DGAQA" ? "Directorate General of Aeronautical Quality Assurance" : agency === "CEMILAC" ? "Centre for Military Airworthiness and Certification" : "Customer Quality Agency",
      inspectorName,
      workOrderNumber,
      partNumber,
      partName: partName || "Precision Machined Aerospace Component",
      heatNumber: heatNumber || "HEAT-" + Math.floor(1000 + Math.random() * 9000),
      batchQty: Number(batchQty),
      inspectedQty: Number(batchQty),
      passedQty: Number(batchQty),
      status: stampNumber ? "CLEARED" : "PENDING_INSPECTOR_VISIT",
      witnessedTests: [
        { name: "Raw Material MTC & Chemical Composition", status: "PASSED", cert: "MTC-VERIFIED" },
        { name: "CMM Coordinate Dimension Audit", status: "PASSED", cert: "CMM-PASS" },
        { name: "NDT Surface Crack Penetrant Inspection", status: "PASSED", cert: "NDT-CLEARED" },
      ],
      stampNumber: stampNumber || "",
      clearanceDate: stampNumber ? new Date().toISOString() : null,
      remarks: remarks || "Source inspection logged and verified.",
    };

    setInspections([newRecord, ...inspections]);
    setSelectedInspection(newRecord);
    soundFx.playSuccess();
    toast.success("Government / Customer Source Inspection logged!");
    setInspectorName("");
    setWorkOrderNumber("");
    setPartNumber("");
    setPartName("");
    setHeatNumber("");
    setBatchQty(10);
    setStampNumber("");
    setRemarks("");
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-500/20 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-mono font-bold border border-blue-500/30">
              DEFENSE & AEROSPACE GATE
            </span>
            <span className="text-xs text-white/50 font-mono">DGAQA // CEMILAC // DGQA // CSI</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Government & Customer Source Inspection Gate
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Mandatory physical hold-point clearance for defense and tier-1 aerospace contracts. Parts cannot be packaged or dispatched without an authorized government or resident customer quality stamp.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
            <div className="text-xl font-black text-emerald-400 font-mono">
              {inspections.filter((i) => i.status === "CLEARED").length}
            </div>
            <div className="text-[10px] text-white/50 uppercase font-mono font-bold">Cleared Batches</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
            <div className="text-xl font-black text-amber-400 font-mono">
              {inspections.filter((i) => i.status !== "CLEARED").length}
            </div>
            <div className="text-[10px] text-white/50 uppercase font-mono font-bold">Pending Visits</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Inspections List */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono font-bold text-white/70 uppercase tracking-wider flex items-center justify-between">
            <span>Inspection Registers</span>
            <span className="text-cyan-400">{inspections.length} Total</span>
          </h2>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {inspections.map((insp) => {
              const isSelected = selectedInspection?.id === insp.id;
              const isCleared = insp.status === "CLEARED";
              return (
                <div
                  key={insp.id}
                  onClick={() => {
                    setSelectedInspection(insp);
                    soundFx.playClick();
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-500/15 border-blue-400 ring-1 ring-blue-400/30"
                      : "bg-white/[0.02] hover:bg-white/[0.05] border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-black text-white">{insp.id}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                        isCleared
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      }`}
                    >
                      {isCleared ? "CLEARED & STAMPED" : "PENDING VISIT"}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-white/90">{insp.partName}</h3>
                  <p className="text-[11px] text-white/50 font-mono mt-0.5">
                    WO: {insp.workOrderNumber} • {insp.agency}
                  </p>

                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/10 text-[10px] text-white/60 font-mono">
                    <span>Batch: {insp.batchQty} pcs</span>
                    {insp.stampNumber && <span className="text-cyan-300 font-bold">Stamp: {insp.stampNumber}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Middle: Inspection Dossier Detail */}
        <div className="lg:col-span-2 space-y-6">
          {selectedInspection && (
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-6">
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-mono font-black">
                      {selectedInspection.agency}
                    </span>
                    <h2 className="text-base font-extrabold text-white">{selectedInspection.partName}</h2>
                  </div>
                  <p className="text-xs text-white/50 font-mono mt-1">
                    {selectedInspection.agencyFull} • Inspector: {selectedInspection.inspectorName}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-white/70">Part Number</div>
                  <div className="text-xs font-mono font-black text-cyan-300">{selectedInspection.partNumber}</div>
                </div>
              </div>

              {/* Clearance Stamp Badge */}
              {selectedInspection.stampNumber ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-300">
                      <Stamp className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-mono font-black text-emerald-300">
                        OFFICIAL GOVERNMENT CLEARANCE STAMP
                      </div>
                      <div className="text-sm font-mono font-bold text-white tracking-widest">
                        {selectedInspection.stampNumber}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] font-mono text-emerald-300/80">
                    Cleared on: {new Date(selectedInspection.clearanceDate!).toLocaleDateString()}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
                  <Clock className="w-6 h-6 text-amber-400" />
                  <div>
                    <div className="text-xs font-mono font-black text-amber-300">AWAITING WITNESS CLEARANCE</div>
                    <div className="text-[11px] text-white/60">
                      Physical inspection hold is active. Dispatch is locked until the government inspector signs off.
                    </div>
                  </div>
                </div>
              )}

              {/* Witnessed Tests Matrix */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-bold text-white/80 uppercase">
                  Mandatory Witnessed Test Checkpoints:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedInspection.witnessedTests.map((t, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{t.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                            t.status === "PASSED"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      {t.cert && (
                        <div className="text-[10px] font-mono text-cyan-300/80 flex items-center gap-1">
                          <FileCheck className="w-3 h-3" />
                          <span>Cert: {t.cert}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Lot Pedigree & Traceability */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-black/40 border border-white/10 font-mono text-xs">
                <div>
                  <span className="text-white/40 block text-[10px]">HEAT / MELT LOT</span>
                  <span className="font-bold text-white">{selectedInspection.heatNumber}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px]">WORK ORDER</span>
                  <span className="font-bold text-white">{selectedInspection.workOrderNumber}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px]">INSPECTED QTY</span>
                  <span className="font-bold text-emerald-400">{selectedInspection.inspectedQty} pcs</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px]">PASSED QTY</span>
                  <span className="font-bold text-cyan-300">{selectedInspection.passedQty} pcs</span>
                </div>
              </div>

              <div className="text-xs text-white/70 bg-white/[0.02] p-3.5 rounded-xl border border-white/10 leading-relaxed font-sans">
                <strong>Inspector Remarks:</strong> {selectedInspection.remarks}
              </div>
            </div>
          )}

          {/* Form to Log New Source Inspection Clearance */}
          <form onSubmit={handleCreate} className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <Plus className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-mono font-bold text-white uppercase">
                Record New Government / Customer Source Inspection
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Inspection Agency *</label>
                <select
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
                >
                  <option value="DGAQA">DGAQA (Defense Aviation)</option>
                  <option value="CEMILAC">CEMILAC (Military Airworthiness)</option>
                  <option value="DGQA">DGQA (Defense Armaments)</option>
                  <option value="Boeing CSI">Boeing CSI (Aerospace)</option>
                  <option value="Airbus CSI">Airbus CSI (Aerospace)</option>
                  <option value="ISRO QA">ISRO QA (Space & Launch)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Inspector Full Name *</label>
                <input
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  placeholder="E.g. Wg Cdr A. K. Varma"
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Work Order # *</label>
                <input
                  value={workOrderNumber}
                  onChange={(e) => setWorkOrderNumber(e.target.value)}
                  placeholder="WO-2026-0501"
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Part Number *</label>
                <input
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="AERO-SPAR-771"
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Heat / Melt Lot #</label>
                <input
                  value={heatNumber}
                  onChange={(e) => setHeatNumber(e.target.value)}
                  placeholder="MID-TI-9912"
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Official Stamp # (If Cleared)</label>
                <input
                  value={stampNumber}
                  onChange={(e) => setStampNumber(e.target.value)}
                  placeholder="DGAQA-HYD-991"
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-cyan-300 font-mono font-bold uppercase"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-blue-500/20 cursor-pointer flex items-center gap-2"
              >
                <Stamp className="w-3.5 h-3.5" />
                <span>Sign & Issue Source Clearance</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
