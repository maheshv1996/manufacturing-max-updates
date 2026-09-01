"use client";

import { useState } from "react";
import {
  Award,
  CheckCircle2,
  Calculator,
  Compass,
  ArrowRight,
  Sparkles,
  Zap,
  RotateCcw,
  Target,
} from "lucide-react";
import Link from "next/link";

export type BeltTier = "white" | "yellow" | "green" | "black" | "mbb" | "champion";

interface BeltInfo {
  id: BeltTier;
  title: string;
  badge: string;
  color: string;
  border: string;
  bgSoft: string;
  role: string;
  timeCommitment: string;
  focus: string;
  coreTools: string[];
  keyOutcomes: string[];
}

const BELTS: BeltInfo[] = [
  {
    id: "white",
    title: "White Belt",
    badge: "Level 1 â€¢ Awareness",
    color: "#f8fafc",
    border: "border-slate-400/40",
    bgSoft: "bg-slate-500/10",
    role: "Frontline Operators & Shopfloor Staff",
    timeCommitment: "5% (Continuous floor hygiene)",
    focus: "Cultural awareness of Lean principles, eliminating the 8 Wastes (TIMWOODS), and active 5S workplace discipline.",
    coreTools: ["8 Wastes (TIMWOODS)", "5S Visual Workplace", "Poka-Yoke Concepts", "Standard Work", "Andon Defect Flagging"],
    keyOutcomes: ["Instant abnormality escalation", "Reduced clutter and search time", "Zero-defect mindset at station"],
  },
  {
    id: "yellow",
    title: "Yellow Belt",
    badge: "Level 2 â€¢ Contributor",
    color: "#eab308",
    border: "border-yellow-500/40",
    bgSoft: "bg-yellow-500/10",
    role: "Supervisors, Technicians & Junior Quality Leads",
    timeCommitment: "15% (Project support)",
    focus: "DMAIC project support, accurate Gemba data collection, and fundamental root cause mapping.",
    coreTools: ["SIPOC Process Mapping", "Fishbone (Ishikawa) Diagram", "5-Whys Analysis", "Pareto 80/20 Charts", "Process Flowcharts"],
    keyOutcomes: ["Unbiased data sampling", "Clear problem statement drafting", "Immediate root-cause containment"],
  },
  {
    id: "green",
    title: "Green Belt",
    badge: "Level 3 â€¢ Practitioner",
    color: "#10b981",
    border: "border-emerald-500/40",
    bgSoft: "bg-emerald-500/10",
    role: "Process Engineers, Quality Engineers & Operations Leads",
    timeCommitment: "25% - 50% (Part-time project lead)",
    focus: "Leading mid-sized departmental DMAIC projects to reduce scrap, stabilize cycle times, and improve First Pass Yield (FPY).",
    coreTools: ["Process Capability (Cp, Cpk, Pp, Ppk)", "Measurement System Analysis (Gage R&R < 10%)", "Statistical Process Control (SPC)", "Hypothesis Testing (t-tests, ANOVA)", "FMEA (RPN Reduction)"],
    keyOutcomes: ["Cp/Cpk â‰¥ 1.67 process capability", "Scrap reduction of 20-40%", "Validated Gage R&R measurement systems"],
  },
  {
    id: "black",
    title: "Black Belt",
    badge: "Level 4 â€¢ Change Agent",
    color: "#38bdf8",
    border: "border-cyan-500/40",
    bgSoft: "bg-cyan-500/10",
    role: "Full-Time Continuous Improvement & Operational Excellence Leads",
    timeCommitment: "100% (Dedicated full-time)",
    focus: "Cross-functional, multi-variable complex problem solving, statistical modeling, and mentoring Green Belts.",
    coreTools: ["Design of Experiments (Full/Fractional DOE)", "Multiple Linear & Logistic Regression", "Multi-Vari Variance Decomposition", "Monte Carlo Risk Simulation", "Cost of Poor Quality (COPQ) Quantification"],
    keyOutcomes: ["Major COPQ reduction ($50k - $250k+ per project)", "Multi-variable optimization", "Enterprise throughput acceleration"],
  },
  {
    id: "mbb",
    title: "Master Black Belt (MBB)",
    badge: "Level 5 â€¢ Program Architect",
    color: "#a855f7",
    border: "border-purple-500/40",
    bgSoft: "bg-purple-500/10",
    role: "Senior Director of Quality & Enterprise Excellence",
    timeCommitment: "100% (Strategic coaching & governance)",
    focus: "Enterprise statistical governance, methodology deployment, AS9100D / IATF 16949 standard compliance, and executive coaching.",
    coreTools: ["Statistical Governance Frameworks", "Enterprise Value Stream Architecture", "Advanced Statistical Quality Auditing", "Executive Portfolio Prioritization", "AS9100 / IATF Quality Systems"],
    keyOutcomes: ["Plant-wide zero-escape quality gate", "Certified Green/Black Belt workforce pipeline", "Predictive quality compliance"],
  },
  {
    id: "champion",
    title: "Champion / Executive Sponsor",
    badge: "Level 6 â€¢ Sponsor & Executive",
    color: "#f59e0b",
    border: "border-amber-500/40",
    bgSoft: "bg-amber-500/10",
    role: "Plant Manager, VP of Operations, Managing Director",
    timeCommitment: "10% (Governance & obstacle removal)",
    focus: "Aligning Six Sigma initiatives with corporate EBITDA goals, chartering high-impact projects, and unblocking resources.",
    coreTools: ["Project Charter Authorization", "Resource Allocation Gate", "Financial ROI Validation", "Tollgate Milestone Sign-off", "Executive Policy Deployment (Hoshin Kanri)"],
    keyOutcomes: ["Unblocked cross-departmental execution", "Direct P&L margin expansion", "Sustained executive momentum"],
  },
];

const DMAIC_STEPS = [
  {
    phase: "D",
    name: "Define",
    desc: "Specify the problem, customer requirements (VOC to CTQ), and project charter.",
    deliverables: ["Project Charter with baseline metrics", "SIPOC Diagram", "Voice of Customer (CTQ Tree)", "Financial Impact Projection"],
    toolLink: "/quality/objectives",
  },
  {
    phase: "M",
    name: "Measure",
    desc: "Validate the measurement system and collect baseline performance data.",
    deliverables: ["Data Collection Plan", "Gage R&R ANOVA Study (< 10% target)", "Baseline Process Sigma & DPMO", "Process Flowchart Map"],
    toolLink: "/quality/grr",
  },
  {
    phase: "A",
    name: "Analyze",
    desc: "Identify root causes and statistically isolate key input variables (X's).",
    deliverables: ["Ishikawa Fishbone & 5-Whys", "Hypothesis Tests (t-test, ANOVA)", "Process Capability (Cp/Cpk analysis)", "Design FMEA with RPNs"],
    toolLink: "/quality/8d",
  },
  {
    phase: "I",
    name: "Improve",
    desc: "Develop, pilot, and implement mistake-proofed corrective solutions.",
    deliverables: ["Design of Experiments (DOE) optimization", "Poka-Yoke (Mistake Proofing)", "Pilot Implementation Run", "Before-and-After Verification"],
    toolLink: "/system/kaizen",
  },
  {
    phase: "C",
    name: "Control",
    desc: "Standardize gains and lock in ongoing statistical monitoring.",
    deliverables: ["Control Plan Integration", "Automated SPC X-bar & R Charts", "Standard Operating Procedure (SOP)", "Financial Validation Sign-off"],
    toolLink: "/quality/spc-charts",
  },
];

export default function SixSigmaBeltMatrix() {
  const [selectedBelt, setSelectedBelt] = useState<BeltTier>("green");
  const [activeTab, setActiveTab] = useState<"belts" | "dmaic" | "calc">("belts");

  // Calculator State
  const [units, setUnits] = useState<string>("1000");
  const [opportunities, setOpportunities] = useState<string>("5");
  const [defects, setDefects] = useState<string>("3");

  const numUnits = Math.max(1, Number(units) || 1);
  const numOpps = Math.max(1, Number(opportunities) || 1);
  const numDefects = Math.max(0, Number(defects) || 0);

  const totalOpportunities = numUnits * numOpps;
  const dpo = numDefects / totalOpportunities;
  const dpmo = Math.round(dpo * 1000000);
  const yieldPct = Math.max(0, (1 - dpo) * 100).toFixed(4);

  // Approximate Six Sigma calculation with 1.5 sigma shift
  let sigmaLevel = 0;
  if (dpmo <= 0) {
    sigmaLevel = 6.0;
  } else if (dpmo >= 1000000) {
    sigmaLevel = 0.0;
  } else {
    // Standard approximation: 0.8406 + sqrt(29.37 - 2.221 * ln(DPMO))
    const calcZ = 0.8406 + Math.sqrt(Math.max(0, 29.37 - 2.221 * Math.log(Math.max(1, dpmo))));
    sigmaLevel = Number(Math.min(6.0, Math.max(0, calcZ)).toFixed(2));
  }

  const activeBeltInfo = BELTS.find((b) => b.id === selectedBelt) || BELTS[2];

  return (
    <div className="space-y-6">
      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/30">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>Six Sigma &amp; DMAIC Excellence</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Statistical Operating Model
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Structured Competencies, DMAIC Roadmaps &amp; Real-Time Process Sigma Tools
            </p>
          </div>
        </div>

        {/* SUB-TABS */}
        <div className="flex items-center p-1 rounded-xl border border-slate-700 bg-slate-800/80">
          <button
            onClick={() => setActiveTab("belts")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "belts"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Belt Hierarchy
          </button>
          <button
            onClick={() => setActiveTab("dmaic")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "dmaic"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
          >
            DMAIC Roadmap
          </button>
          <button
            onClick={() => setActiveTab("calc")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "calc"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Calculator className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sigma Calculator</span>
          </button>
        </div>
      </div>

      {/* TAB 1: BELT HIERARCHY */}
      {activeTab === "belts" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* BELT SELECTOR PILLS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {BELTS.map((belt) => {
              const isSelected = belt.id === selectedBelt;
              return (
                <button
                  key={belt.id}
                  onClick={() => setSelectedBelt(belt.id)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? "bg-slate-800 border-blue-500 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10"
                      : "bg-slate-800/40 border-slate-700/80 hover:bg-slate-800/80 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full ring-2 ring-white/20"
                      style={{ backgroundColor: belt.color }}
                    />
                    <span className="text-[10px] font-mono text-slate-400 font-bold">
                      {belt.badge.split("â€¢")[0].trim()}
                    </span>
                  </div>
                  <div className="text-xs font-black text-white truncate">
                    {belt.title}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ACTIVE BELT DETAIL CARD */}
          <div className="p-6 rounded-3xl glass-card border border-slate-700 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
              <div className="flex items-center gap-3">
                <span
                  className="w-5 h-5 rounded-full ring-4 ring-white/20 shrink-0"
                  style={{ backgroundColor: activeBeltInfo.color }}
                />
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <span>{activeBeltInfo.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {activeBeltInfo.badge}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Target Role: <strong className="text-slate-200">{activeBeltInfo.role}</strong> â€¢ Time Allocation: <strong className="text-slate-200">{activeBeltInfo.timeCommitment}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* FOCUS & MISSION */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                  <Compass className="w-4 h-4" />
                  <span>Strategic Mission</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                  {activeBeltInfo.focus}
                </p>
              </div>

              {/* CORE TOOLKIT */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                  <span>Core Tool Arsenal</span>
                </div>
                <ul className="space-y-1.5 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                  {activeBeltInfo.coreTools.map((tool, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-200 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{tool}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* MEASURABLE IMPACT */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                  <Target className="w-4 h-4" />
                  <span>Verified Deliverables</span>
                </div>
                <ul className="space-y-1.5 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                  {activeBeltInfo.keyOutcomes.map((outcome, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-200 font-medium">
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DMAIC ROADMAP */}
      {activeTab === "dmaic" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {DMAIC_STEPS.map((step) => (
              <div
                key={step.phase}
                className="p-5 rounded-3xl glass-card border border-slate-700 flex flex-col justify-between space-y-4 hover:border-blue-500/50 transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-400 font-black text-base flex items-center justify-center font-mono">
                      {step.phase}
                    </span>
                    <span className="text-xs font-black uppercase text-slate-400 font-mono tracking-wider">
                      {step.name}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed min-h-[48px]">
                    {step.desc}
                  </p>

                  <div className="border-t border-slate-800 pt-3 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                      Key Artifacts
                    </span>
                    {step.deliverables.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                        <span className="text-blue-400 font-mono">â€¢</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href={step.toolLink}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-blue-600/20 text-blue-400 border border-slate-700 hover:border-blue-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer group-hover:shadow-sm"
                >
                  <span>Open Tool</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SIGMA LEVEL & DPMO CALCULATOR */}
      {activeTab === "calc" && (
        <div className="p-6 rounded-3xl glass-card border border-slate-700 space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <Calculator className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white">
                Live DPMO &amp; Process Sigma (Z-Score) Calculator
              </h3>
            </div>
            <button
              onClick={() => {
                setUnits("1000");
                setOpportunities("5");
                setDefects("3");
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800/60 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* INPUTS */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Total Units Sampled / Produced (N)
                </label>
                <input
                  type="number"
                  min="1"
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. 1000"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Defect Opportunities Per Unit (O)
                </label>
                <input
                  type="number"
                  min="1"
                  value={opportunities}
                  onChange={(e) => setOpportunities(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. 5"
                />
                <p className="text-[11px] text-slate-500">
                  Number of critical-to-quality dimensions, weld seams, or electrical checks per piece.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Total Defects Observed (D)
                </label>
                <input
                  type="number"
                  min="0"
                  value={defects}
                  onChange={(e) => setDefects(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. 3"
                />
              </div>
            </div>

            {/* RESULTS TILES */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Total Opportunities
                </span>
                <div className="text-2xl font-black text-white font-mono my-2">
                  {totalOpportunities.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  {numUnits} units Ã— {numOpps} opps
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  First-Time Yield %
                </span>
                <div className="text-2xl font-black text-emerald-400 font-mono my-2">
                  {yieldPct}%
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  Defect Rate: {(dpo * 100).toFixed(4)}%
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  DPMO
                </span>
                <div className="text-2xl font-black text-cyan-400 font-mono my-2">
                  {dpmo.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  Defects Per Million Opps
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-500/40 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">
                  Process Sigma (Z)
                </span>
                <div className="text-3xl font-black text-white font-mono my-2">
                  {sigmaLevel} Ïƒ
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold font-mono inline-block w-fit bg-blue-600/30 text-blue-200 border border-blue-400/30">
                  {sigmaLevel >= 6.0 ? "World Class (6Ïƒ)" : sigmaLevel >= 4.0 ? "Industry Standard (4-5Ïƒ)" : "Needs DMAIC (â‰¤3Ïƒ)"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
