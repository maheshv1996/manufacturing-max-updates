"use client";

import { useState } from "react";
import {
  calculateCncTurning,
  MATERIAL_DATABASE,
  TurningCalculationResult,
} from "@/lib/cncEngine";
import {
  Calculator,
  Gauge,
  Cpu,
  Layers,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

export default function CncCalculatorPageClient() {
  const [materialId, setMaterialId] = useState<string>("STEEL-EN8");
  const [workpieceDiameter, setWorkpieceDiameter] = useState<number>(50);
  const [lengthOfCut, setLengthOfCut] = useState<number>(120);
  const [cuttingSpeedVc, setCuttingSpeedVc] = useState<number>(200);
  const [feedPerRev, setFeedPerRev] = useState<number>(0.25);
  const [depthOfCutAp, setDepthOfCutAp] = useState<number>(2.0);
  const [noseRadius, setNoseRadius] = useState<number>(0.8);
  const [passesCount, setPassesCount] = useState<number>(1);

  const selectedMaterial =
    MATERIAL_DATABASE[materialId] || MATERIAL_DATABASE["STEEL-EN8"];

  // Trigger calculation
  const result: TurningCalculationResult = calculateCncTurning({
    workpieceDiameterMm: Number(workpieceDiameter) || 1,
    lengthOfCutMm: Number(lengthOfCut) || 1,
    cuttingSpeedVcMMin: Number(cuttingSpeedVc) || 10,
    feedPerRevMm: Number(feedPerRev) || 0.05,
    depthOfCutApMm: Number(depthOfCutAp) || 0.5,
    noseRadiusREpsilonMm: Number(noseRadius) || 0.8,
    materialId,
    passesCount: Number(passesCount) || 1,
  });

  const handleMaterialChange = (newMatId: string) => {
    setMaterialId(newMatId);
    const mat = MATERIAL_DATABASE[newMatId];
    if (mat) {
      setCuttingSpeedVc(mat.recommendedVc.opt);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)] p-6 space-y-6">
      <PageHeader
        title="CNC Turning & Machining Engineering Calculator"
        description="Calculate spindle speeds, table feeds, material removal rates (MRR), cutting power, and surface roughness (Ra)"
        icon={<Calculator className="w-5 h-5" />}
        iconTone="cyan"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Input Parameters */}
        <div className="lg:col-span-1 bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-xl p-5 shadow-lg space-y-5">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold border-b border-[var(--surface-3)] pb-3">
            <Calculator className="w-5 h-5" />
            <span>Cutting & Geometry Parameters</span>
          </div>

          {/* Material Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">
              Workpiece Material
            </label>
            <select
              value={materialId}
              onChange={(e) => handleMaterialChange(e.target.value)}
              className="w-full bg-[var(--surface-2)] border border-[var(--surface-3)] rounded-lg px-3 py-2 text-sm text-[var(--text-1)] focus:outline-none focus:border-cyan-500"
            >
              {Object.values(MATERIAL_DATABASE).map((mat) => (
                <option key={mat.id} value={mat.id}>
                  {mat.name} ({mat.category})
                </option>
              ))}
            </select>
            <div className="text-xs text-[var(--text-3)] flex justify-between">
              <span>
                Rec. Vc: {selectedMaterial.recommendedVc.min} -{" "}
                {selectedMaterial.recommendedVc.max} m/min
              </span>
              <span>kc1: {selectedMaterial.kc1} N/mm²</span>
            </div>
          </div>

          {/* Diameter & Cut Length */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-[var(--text-2)] font-medium">
                Workpiece Diam (mm)
              </label>
              <input
                type="number"
                value={workpieceDiameter}
                onChange={(e) =>
                  setWorkpieceDiameter(Math.max(1, Number(e.target.value)))
                }
                className="w-full bg-[var(--surface-2)] border border-[var(--surface-3)] rounded-lg px-3 py-2 text-sm text-[var(--text-1)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[var(--text-2)] font-medium">
                Length of Cut (mm)
              </label>
              <input
                type="number"
                value={lengthOfCut}
                onChange={(e) =>
                  setLengthOfCut(Math.max(1, Number(e.target.value)))
                }
                className="w-full bg-[var(--surface-2)] border border-[var(--surface-3)] rounded-lg px-3 py-2 text-sm text-[var(--text-1)]"
              />
            </div>
          </div>

          {/* Cutting Speed & Feed */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-[var(--text-2)] font-medium">
                Cutting Speed Vc (m/min)
              </label>
              <input
                type="number"
                value={cuttingSpeedVc}
                onChange={(e) =>
                  setCuttingSpeedVc(Math.max(1, Number(e.target.value)))
                }
                className="w-full bg-[var(--surface-2)] border border-[var(--surface-3)] rounded-lg px-3 py-2 text-sm text-[var(--text-1)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[var(--text-2)] font-medium">
                Feed fn (mm/rev)
              </label>
              <input
                type="number"
                step="0.01"
                value={feedPerRev}
                onChange={(e) =>
                  setFeedPerRev(Math.max(0.01, Number(e.target.value)))
                }
                className="w-full bg-[var(--surface-2)] border border-[var(--surface-3)] rounded-lg px-3 py-2 text-sm text-[var(--text-1)]"
              />
            </div>
          </div>

          {/* Depth of Cut & Nose Radius */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-[var(--text-2)] font-medium">
                Depth of Cut ap (mm)
              </label>
              <input
                type="number"
                step="0.1"
                value={depthOfCutAp}
                onChange={(e) =>
                  setDepthOfCutAp(Math.max(0.1, Number(e.target.value)))
                }
                className="w-full bg-[var(--surface-2)] border border-[var(--surface-3)] rounded-lg px-3 py-2 text-sm text-[var(--text-1)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[var(--text-2)] font-medium">
                Insert Nose Radius rε (mm)
              </label>
              <select
                value={noseRadius}
                onChange={(e) => setNoseRadius(Number(e.target.value))}
                className="w-full bg-[var(--surface-2)] border border-[var(--surface-3)] rounded-lg px-3 py-2 text-sm text-[var(--text-1)]"
              >
                <option value={0.2}>0.2 mm (Finishing)</option>
                <option value={0.4}>0.4 mm (General)</option>
                <option value={0.8}>0.8 mm (Roughing/General)</option>
                <option value={1.2}>1.2 mm (Heavy Roughing)</option>
                <option value={1.6}>1.6 mm (Extreme Roughing)</option>
              </select>
            </div>
          </div>

          {/* Passes Count */}
          <div className="space-y-1">
            <label className="text-xs text-[var(--text-2)] font-medium">
              Number of Passes
            </label>
            <input
              type="number"
              min="1"
              value={passesCount}
              onChange={(e) =>
                setPassesCount(Math.max(1, Number(e.target.value)))
              }
              className="w-full bg-[var(--surface-2)] border border-[var(--surface-3)] rounded-lg px-3 py-2 text-sm text-[var(--text-1)]"
            />
          </div>

          <button
            onClick={() => {
              setCuttingSpeedVc(selectedMaterial.recommendedVc.opt);
              setFeedPerRev(0.2);
              setDepthOfCutAp(2.0);
              setNoseRadius(0.8);
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-xs text-[var(--text-2)] border border-[var(--surface-3)] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Material Defaults
          </button>
        </div>

        {/* Right Column: Computed Outputs & Analytics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Spindle Speed */}
            <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-xl p-4 shadow">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold mb-1">
                <Gauge className="w-4 h-4" />
                <span>SPINDLE SPEED</span>
              </div>
              <div className="text-2xl font-bold text-[var(--text-1)]">
                {result.spindleSpeedRpm.toLocaleString()}{" "}
                <span className="text-xs font-normal text-[var(--text-3)]">
                  RPM
                </span>
              </div>
              <div className="text-xs text-[var(--text-2)] mt-1">
                N = (Vc × 1000) / (π × D)
              </div>
            </div>

            {/* Feed Rate */}
            <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-xl p-4 shadow">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-1">
                <Layers className="w-4 h-4" />
                <span>FEED RATE (Vf)</span>
              </div>
              <div className="text-2xl font-bold text-[var(--text-1)]">
                {result.feedRateMmMin.toLocaleString()}{" "}
                <span className="text-xs font-normal text-[var(--text-3)]">
                  mm/min
                </span>
              </div>
              <div className="text-xs text-[var(--text-2)] mt-1">
                Vf = fn × N
              </div>
            </div>

            {/* Machining Cycle Time */}
            <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-xl p-4 shadow">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-1">
                <Cpu className="w-4 h-4" />
                <span>CYCLE TIME (Tc)</span>
              </div>
              <div className="text-2xl font-bold text-[var(--text-1)]">
                {result.cuttingTimeSec}{" "}
                <span className="text-xs font-normal text-[var(--text-3)]">
                  sec
                </span>
              </div>
              <div className="text-xs text-[var(--text-2)] mt-1">
                {(result.cuttingTimeSec / 60).toFixed(2)} min ({passesCount}{" "}
                pass{passesCount > 1 ? "es" : ""})
              </div>
            </div>

            {/* Surface Roughness Ra */}
            <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-xl p-4 shadow">
              <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold mb-1">
                <Calculator className="w-4 h-4" />
                <span>SURFACE Ra</span>
              </div>
              <div className="text-2xl font-bold text-[var(--text-1)]">
                {result.estimatedSurfaceRoughnessRaMicrons}{" "}
                <span className="text-xs font-normal text-[var(--text-3)]">
                  µm
                </span>
              </div>
              <div className="text-xs text-[var(--text-2)] mt-1">
                Theoretical: Ra ≈ fn² / (32·rε)
              </div>
            </div>
          </div>

          {/* Secondary Power & Removal Rates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-xl p-5 shadow space-y-3">
              <h3 className="text-sm font-semibold text-[var(--text-1)]">
                Material Removal & Power Demand
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-[var(--surface-3)]">
                  <span className="text-[var(--text-2)]">
                    Metal Removal Rate (Q):
                  </span>
                  <span className="font-semibold text-cyan-400">
                    {result.metalRemovalRateCm3Min} cm³/min
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[var(--surface-3)]">
                  <span className="text-[var(--text-2)]">
                    Cutting Power Required (Pc):
                  </span>
                  <span className="font-semibold text-amber-400">
                    {result.cuttingPowerKw} kW
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[var(--text-2)]">
                    Average Chip Thickness (hm):
                  </span>
                  <span className="font-semibold text-[var(--text-1)]">
                    {result.chipThicknessHm} mm
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-xl p-5 shadow space-y-3">
              <h3 className="text-sm font-semibold text-[var(--text-1)]">
                Engineering Advisory & Recommendations
              </h3>
              {result.recommendations.length > 0 ? (
                <div className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Parameters are optimized within manufacturer carbide turning
                    envelope for {selectedMaterial.name}.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
