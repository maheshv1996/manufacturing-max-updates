"use client";

import { useState } from "react";
import {
  QrCode,
  Copy,
  Check,
  Cpu,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";

export default function PartMarkingClient() {
  const [cageCode, setCageCode] = useState("7842A");
  const [partNumber, setPartNumber] = useState("TASL-AP-6842");
  const [revision, setRevision] = useState("REV-D");
  const [serialNumber, setSerialNumber] = useState("SN-2026-0894");
  const [lotNumber, setLotNumber] = useState("MID-TI-8942");
  const [standard, setStandard] = useState("MIL-STD-130N");
  const [copied, setCopied] = useState(false);

  const humanReadable = `CAGE: ${cageCode} | PN: ${partNumber} | REV: ${revision} | SN: ${serialNumber} | LOT: ${lotNumber}`;
  const rawSyntax = `[)>\x1E06\x1D17V${cageCode}\x1D1P${partNumber}\x1D14K${revision}\x1DS${serialNumber}\x1E\x04`;

  const copySyntax = () => {
    navigator.clipboard.writeText(rawSyntax);
    setCopied(true);
    soundFx.playClick();
    toast.success("Laser marking DataMatrix syntax copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-blue-950/40 border border-purple-500/20 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-mono font-bold border border-purple-500/30">
              DIRECT PART MARKING (DPM)
            </span>
            <span className="text-xs text-white/50 font-mono">MIL-STD-130N // GS1 // ISO/IEC 16022</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            2D DataMatrix Laser Marking & UID Generator
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Generates standardized ECC-200 2D DataMatrix strings with ASCII escape formatting for direct laser etching, dot-peen stamping, and UID aerospace compliance.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Config */}
        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
          <h2 className="text-xs font-mono font-bold text-white uppercase border-b border-white/10 pb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>Marking Parameters</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono text-white/60 block mb-1">Standard / Protocol</label>
              <select
                value={standard}
                onChange={(e) => setStandard(e.target.value)}
                className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
              >
                <option value="MIL-STD-130N">MIL-STD-130N (US DoD / Aerospace)</option>
                <option value="GS1">GS1 DataMatrix (Medical / Automotive)</option>
                <option value="ISO_16022">ISO/IEC 16022 (Direct Part Marking)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono text-white/60 block mb-1">Enterprise CAGE Code *</label>
              <input
                value={cageCode}
                onChange={(e) => setCageCode(e.target.value.toUpperCase())}
                placeholder="7842A"
                className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono uppercase"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-white/60 block mb-1">Part Number (PNO) *</label>
              <input
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                placeholder="TASL-AP-6842"
                className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-white/60 block mb-1">Engineering Revision</label>
              <input
                value={revision}
                onChange={(e) => setRevision(e.target.value)}
                placeholder="REV-D"
                className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-white/60 block mb-1">Serial Number (UID) *</label>
              <input
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="SN-2026-0894"
                className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-white/60 block mb-1">Melt Lot / Batch #</label>
              <input
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="MID-TI-8942"
                className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* Visual Preview & Laser Output */}
        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-xs font-mono font-bold text-white uppercase border-b border-white/10 pb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-cyan-400" />
                <span>ECC-200 Simulated 2D Matrix</span>
              </span>
              <span className="text-[10px] text-cyan-300 font-mono">16x16 Cell Array</span>
            </h2>

            {/* Matrix Visual Mock */}
            <div className="flex items-center justify-center p-6 bg-black/60 rounded-2xl border border-white/10">
              <div className="p-4 bg-white rounded-xl shadow-2xl flex flex-col items-center">
                <div className="w-28 h-28 bg-[#0a0a0a] p-2 flex flex-wrap gap-0.5 justify-center items-center">
                  {Array.from({ length: 64 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 ${
                        (i * 7 + 3) % 2 === 0 || i % 8 === 0 || i < 8 ? "bg-white" : "bg-black"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[8px] font-mono text-black font-black mt-2">{serialNumber}</span>
              </div>
            </div>

            {/* Output Syntax */}
            <div className="space-y-2 font-mono">
              <div className="flex items-center justify-between text-xs text-white/70">
                <span>Laser Engraver Raw String (ASCII):</span>
                <button
                  onClick={copySyntax}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <div className="p-3 rounded-xl bg-black/60 border border-white/10 text-cyan-300 text-xs break-all">
                {rawSyntax}
              </div>
            </div>

            <div className="space-y-1 font-mono text-xs text-white/60">
              <span>Human Readable Etching Line:</span>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-[11px]">
                {humanReadable}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
