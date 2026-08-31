"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ArrowLeft,
  ArrowRight,
  Rocket,
  Loader2,
  Sparkles,
  Bot,
  Volume2,
  VolumeX,
  ShieldCheck,
  Cpu,
  Layers,
  Zap,
  Factory,
  CheckCircle2,
  Terminal,
  Brain,
  Plane,
  Cog,
  Car,
  Flame,
  HeartPulse,
  Plus,
  Edit2,
  Trash2,
} from "lucide-react";
import { Input } from "@/app/components/ui/Input";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";

interface DeptInfo {
  id: string;
  no: number;
  title: string;
  short: string;
  desc: string;
}

interface SetupState {
  onboardingComplete: boolean;
  onboardingSkipped: boolean;
  activeDepartments: string[] | null;
  branding: {
    appName?: string;
    companyName?: string;
    companyGstin?: string;
    companyAddress?: string;
    logoUrl?: string;
  };
  companyCurrency: string | null;
  fiscalYearStart: string | null;
  dbEmpty: boolean;
  departments: DeptInfo[];
}

const INDUSTRIES = [
  {
    id: "aerospace",
    name: "Aerospace & Defense",
    standard: "AS9100 Rev D / AS9102",
    icon: Plane,
    desc: "Titanium/Inconel machining, FAI First Article inspection, Nadcap special processes, full melt-lot traceability.",
    recommendedDepts: ["ops", "quality", "engineering", "supply", "maintenance", "metrology", "finance", "commercial", "ehs", "people", "rnd", "system", "twin"],
  },
  {
    id: "cnc",
    name: "Precision CNC Machining",
    standard: "ISO 9001 / Lean Six Sigma",
    icon: Cog,
    desc: "3-axis & 5-axis milling, turning, live tool wear tracking, finite capacity scheduling, tool crib management.",
    recommendedDepts: ["ops", "quality", "engineering", "supply", "maintenance", "metrology", "finance", "commercial", "ehs", "people", "system"],
  },
  {
    id: "automotive",
    name: "Automotive & Mobility",
    standard: "IATF 16949 / PPAP Level 3",
    icon: Car,
    desc: "High-volume line balancing, poka-yoke error proofing, PPAP validation, OEE tracking, APQP routines.",
    recommendedDepts: ["ops", "quality", "engineering", "supply", "maintenance", "finance", "commercial", "ehs", "people", "system"],
  },
  {
    id: "fabrication",
    name: "Heavy Fabrication & Vessels",
    standard: "ASME Sec VIII / AWS D1.1",
    icon: Flame,
    desc: "Welder qualification (WPQR), NDT ultrasonic/radiographic testing, plate nesting, pressure hydro-tests.",
    recommendedDepts: ["ops", "quality", "engineering", "supply", "maintenance", "finance", "commercial", "ehs", "people", "system"],
  },
  {
    id: "medical",
    name: "Medical Devices & Implants",
    standard: "ISO 13485 / FDA 21 CFR",
    icon: HeartPulse,
    desc: "Cleanroom validation, bio-compatible titanium/PEEK lot genealogy, sterilization batch records.",
    recommendedDepts: ["ops", "quality", "engineering", "supply", "maintenance", "metrology", "finance", "commercial", "ehs", "people", "rnd", "system"],
  },
  {
    id: "custom",
    name: "Custom / Multi-Domain Enterprise",
    standard: "Fully Tailored / Build Your Own",
    icon: Factory,
    desc: "Custom setup for hybrid manufacturing. Freely select and customize your exact mix of departments.",
    recommendedDepts: ["ops", "quality", "engineering", "supply", "maintenance", "finance", "system"],
  },
];

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];

export default function OnboardingWizard() {
  const [state, setState] = useState<SetupState | null>(null);
  const [introPhase, setIntroPhase] = useState<"welcome" | "aura" | "wizard" | "launching">("welcome");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // Audio Voice State
  const [speaking, setSpeaking] = useState<boolean>(false);
  const [voiceMuted, setVoiceMuted] = useState<boolean>(false);

  // Industry & Infra Mode
  const [selectedIndustry, setSelectedIndustry] = useState<string>("aerospace");
  const [infraMode, setInfraMode] = useState<"ZERO_SENSOR" | "SMART_IOT">("ZERO_SENSOR");

  // S1 — Company
  const [companyName, setCompanyName] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [logoUrl] = useState<string>("");
  const [currency, setCurrency] = useState("INR");
  const [fyStart] = useState("April");

  // S2 — Departments (Fully dynamic add / rename / remove)
  const [customDeptsList, setCustomDeptsList] = useState<DeptInfo[]>([]);
  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptTitle, setNewDeptTitle] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingDeptTitle, setEditingDeptTitle] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());

  // S3 — Team
  const [adminName, setAdminName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [operatorUsername, setOperatorUsername] = useState("");
  const [operatorPassword, setOperatorPassword] = useState("");

  // S4 — Data
  const [loadSample, setLoadSample] = useState(true);

  // Launch Progress
  const [launchProgress, setLaunchProgress] = useState(0);
  const [launchLog, setLaunchLog] = useState("Configuring core database...");

  // Voice narration helper
  const speakText = (text: string) => {
    if (voiceMuted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.02;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setSpeaking(true);
    } catch {}
  };

  const stopVoice = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  };

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SetupState | null) => {
        if (!d) return;
        setState(d);
        if (d.departments) setCustomDeptsList(d.departments);
        if (d.branding?.companyName) setCompanyName(d.branding.companyName);
        if (d.branding?.companyGstin) setCompanyGstin(d.branding.companyGstin);
        if (d.branding?.companyAddress) setCompanyAddress(d.branding.companyAddress);
        if (d.companyCurrency) setCurrency(d.companyCurrency);

        if (d.activeDepartments && d.activeDepartments.length > 0) {
          setSelectedDepts(new Set(d.activeDepartments));
        } else {
          setSelectedDepts(new Set(d.departments.map((x) => x.id)));
        }
      })
      .catch(() => {});
  }, []);

  // Trigger voice on intro screens
  useEffect(() => {
    if (introPhase === "welcome") {
      speakText("Welcome to ManufacturingMax. The digital nervous system of your factory. Let me introduce you to what your new enterprise platform can do.");
    } else if (introPhase === "aura") {
      speakText("Hello! I am AURA, your Autonomous Universal Reliability and Operations Co-Pilot. I will help you configure your factory, assist your team on the shopfloor, and keep your production on track.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introPhase]);

  const handleIndustrySelect = (indId: string) => {
    setSelectedIndustry(indId);
    soundFx.playClick();
    const ind = INDUSTRIES.find((i) => i.id === indId);
    if (ind && state?.departments) {
      const valid = new Set(ind.recommendedDepts.filter((id) => state.departments.some((d) => d.id === id)));
      setSelectedDepts(valid);
      speakText(`Configured profile for ${ind.name}. Recommended modules and compliance standards have been applied.`);
    }
  };

  const handleSelectAllDepts = () => {
    setSelectedDepts(new Set(customDeptsList.map((d) => d.id)));
    soundFx.playClick();
  };

  const handleDeselectAllDepts = () => {
    setSelectedDepts(new Set());
    soundFx.playClick();
  };

  const handleAddCustomDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptTitle.trim()) {
      toast.error("Please enter a department name");
      return;
    }
    const newId = "custom_" + newDeptTitle.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now().toString().slice(-4);
    const created: DeptInfo = {
      id: newId,
      no: customDeptsList.length + 1,
      title: newDeptTitle.trim(),
      short: newDeptTitle.trim().slice(0, 12),
      desc: newDeptDesc.trim() || "Custom operational department",
    };
    setCustomDeptsList([...customDeptsList, created]);
    const next = new Set(selectedDepts);
    next.add(newId);
    setSelectedDepts(next);
    setNewDeptTitle("");
    setNewDeptDesc("");
    setShowAddDept(false);
    soundFx.playSuccess();
    toast.success(`Added custom department "${created.title}"!`);
  };

  const handleSaveRename = (id: string) => {
    if (!editingDeptTitle.trim()) return;
    setCustomDeptsList(
      customDeptsList.map((d) => (d.id === id ? { ...d, title: editingDeptTitle.trim(), short: editingDeptTitle.trim().slice(0, 12) } : d))
    );
    setEditingDeptId(null);
    soundFx.playClick();
    toast.success("Renamed department!");
  };

  const handleRemoveDept = (id: string, title: string) => {
    setCustomDeptsList(customDeptsList.filter((d) => d.id !== id));
    const next = new Set(selectedDepts);
    next.delete(id);
    setSelectedDepts(next);
    soundFx.playClick();
    toast.success(`Removed "${title}"`);
  };

  const handleNextStep = async () => {
    setBusy(true);
    soundFx.playClick();
    try {
      if (step === 0) {
        if (!companyName.trim()) {
          toast.error("Please enter your Company Name");
          setBusy(false);
          return;
        }
        await fetch("/api/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "company",
            branding: { companyName, companyGstin, companyAddress, logoUrl },
            currency,
            fiscalYearStart: fyStart,
          }),
        });
        setStep(1);
      } else if (step === 1) {
        if (selectedDepts.size === 0) {
          toast.error("Please select at least 1 department");
          setBusy(false);
          return;
        }
        await fetch("/api/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "departments",
            ids: Array.from(selectedDepts),
            customDepartments: customDeptsList,
          }),
        });
        setStep(2);
      } else if (step === 2) {
        setStep(3);
      } else if (step === 3) {
        if (adminName.trim() && adminPassword.trim()) {
          const res = await fetch("/api/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "team",
              admin: {
                name: adminName,
                username: adminUsername || "admin",
                email: adminEmail || undefined,
                password: adminPassword,
                isOwner: true,
              },
              operator: operatorName.trim()
                ? {
                    name: operatorName,
                    username: operatorUsername || "operator",
                    password: operatorPassword || "1234",
                  }
                : undefined,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            const err = data.errors?.[0]?.error || "Failed to create administrator";
            toast.error(err);
            setBusy(false);
            return;
          }
        }
        setStep(4);
      } else if (step === 4) {
        setIntroPhase("launching");
        stopVoice();

        if (loadSample && state?.dbEmpty) {
          setLaunchLog("Loading industry demo parts, machines & work orders...");
          setLaunchProgress(25);
          await fetch("/api/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "sample" }),
          });
        }

        setLaunchLog("Calibrating AURA & 12 Autonomous AI Co-Pilots...");
        setLaunchProgress(60);
        await new Promise((r) => setTimeout(r, 600));

        setLaunchLog("Locking 184 enterprise tables & offline security...");
        setLaunchProgress(85);
        await fetch("/api/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "complete" }),
        });

        setLaunchProgress(100);
        setLaunchLog("Factory Core Online! Ready for takeoff.");
        soundFx.playSuccess();
        speakText("Factory configuration complete. Welcome to ManufacturingMax. Your digital nervous system is now fully active.");
        await new Promise((r) => setTimeout(r, 800));
        // Hard reload required after onboarding to re-initialize auth/session and server state
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to complete step");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030408] text-white flex flex-col relative overflow-hidden selection:bg-cyan-500 selection:text-black">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#060815] via-[#030408] to-[#0a0d1e]" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-tr from-cyan-600/10 via-indigo-600/10 to-purple-600/10 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Factory className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-2">
              <span>ManufacturingMax</span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold">
                Enterprise v1.0
              </span>
            </h1>
            <p className="text-[11px] text-white/50">Factory AI Onboarding & Initialization</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (voiceMuted) {
                setVoiceMuted(false);
                speakText("AURA Voice synthesizer unmuted.");
              } else {
                stopVoice();
                setVoiceMuted(true);
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              voiceMuted
                ? "bg-white/5 text-white/40 border-white/10"
                : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm"
            } ${speaking ? "ring-2 ring-cyan-400 animate-pulse" : ""}`}
          >
            {voiceMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
            <span>{voiceMuted ? "AURA Muted" : speaking ? "AURA Speaking..." : "AURA Voice Active"}</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-6 max-w-5xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {introPhase === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full text-center space-y-8 py-8"
            >
              <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 animate-spin blur-md opacity-70" />
                <div className="relative w-20 h-20 rounded-full bg-[#070913] border border-cyan-400/50 flex items-center justify-center shadow-2xl">
                  <Brain className="w-10 h-10 text-cyan-400 animate-pulse" />
                </div>
              </div>

              <div className="space-y-3 max-w-2xl mx-auto">
                <span className="px-3.5 py-1 rounded-full bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold tracking-wide">
                  THE DIGITAL NERVOUS SYSTEM OF YOUR FACTORY
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  Welcome to ManufacturingMax
                </h2>
                <p className="text-sm text-white/70 leading-relaxed">
                  The complete offline-first enterprise platform combining MES, Lean Six Sigma, 13 connected industrial departments, and 12 specialized AI co-pilots.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left max-w-4xl mx-auto">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/40 transition-all space-y-2">
                  <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 w-fit">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-xs text-white">13 Unified Modules</h3>
                  <p className="text-[11px] text-white/50 leading-normal">
                    Production, Quality, SCM, Maintenance, CAM, Finance, and Metrology in 1 database.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-indigo-500/40 transition-all space-y-2">
                  <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 w-fit">
                    <Bot className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-xs text-white">12 AI Co-Pilots</h3>
                  <p className="text-[11px] text-white/50 leading-normal">
                    Predictive maintenance, smart procurement, DFM quoting, and AS9102 inspection.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-purple-500/40 transition-all space-y-2">
                  <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 w-fit">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-xs text-white">100% Offline-First</h3>
                  <p className="text-[11px] text-white/50 leading-normal">
                    Embedded PostgreSQL runs completely inside your local PC with zero internet requirement.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-emerald-500/40 transition-all space-y-2">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 w-fit">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-xs text-white">Zero Sensors Needed</h3>
                  <p className="text-[11px] text-white/50 leading-normal">
                    Delivers full AI intelligence using shopfloor tablet logs, CAD uploads, and digital travelers.
                  </p>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => {
                    setIntroPhase("aura");
                    soundFx.playClick();
                  }}
                  className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-3 border border-cyan-400/30"
                >
                  <span>Meet Your AI Co-Pilot: AURA</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {introPhase === "aura" && (
            <motion.div
              key="aura"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full text-center space-y-8 py-6 max-w-3xl mx-auto"
            >
              <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 animate-spin blur-xl opacity-60" />
                <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-[#0c1024] to-[#04060e] border-2 border-cyan-400/70 flex flex-col items-center justify-center shadow-2xl overflow-hidden">
                  <Sparkles className="w-10 h-10 text-cyan-300 animate-bounce" />
                  <span className="text-[10px] font-mono font-black text-cyan-300 mt-1 tracking-widest">
                    AURA
                  </span>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-white/[0.04] border border-cyan-500/30 backdrop-blur-xl shadow-2xl text-left space-y-4 relative">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      AURA // Factory Chief Intelligence Officer
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-white/40">Human-in-the-Loop Protocol Enforced</span>
                </div>

                <div className="space-y-3 text-sm text-white/90 leading-relaxed font-sans">
                  <p className="font-semibold text-white">
                    "Hello! I am <strong className="text-cyan-300">AURA</strong> — your Autonomous Universal Reliability & Operations Co-Pilot."
                  </p>
                  <p className="text-xs text-white/70">
                    I live inside your factory software to do the heavy mathematical and analytical lifting for your team:
                  </p>
                  <ul className="space-y-2 text-xs text-white/80 pt-1">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <span><strong>Predictive Advice:</strong> I alert you to machine bearing wear, raw material stockouts, and margin leaks before they cause losses.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span><strong>Human-in-the-Loop Safety:</strong> I prepare staged draft proposals and trade-offs. I never execute unapproved destructive changes on my own.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span><strong>Zero-Sensor Ready:</strong> Whether your machines are modern IoT-connected or traditional lathes, I work instantly with your shopfloor tablet data.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  onClick={() => {
                    setIntroPhase("welcome");
                    soundFx.playClick();
                  }}
                  className="px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold text-xs border border-white/10 transition-all cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    setIntroPhase("wizard");
                    stopVoice();
                    soundFx.playClick();
                    speakText("Let us configure your factory profile. Please select your industry specification.");
                  }}
                  className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-2 border border-cyan-400/40"
                >
                  <span>Begin Factory Setup with AURA</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {introPhase === "wizard" && (
            <motion.div
              key="wizard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-mono font-black text-xs">
                    {step + 1}
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-white">
                      {step === 0 && "Step 1: Enterprise Profile & Industry"}
                      {step === 1 && "Step 2: Department Module Customization"}
                      {step === 2 && "Step 3: Factory Infrastructure Mode"}
                      {step === 3 && "Step 4: Master Administrator & Credentials"}
                      {step === 4 && "Step 5: Launch & Database Initialization"}
                    </h2>
                    <p className="text-[11px] text-white/50">
                      {step === 0 && "Select your primary manufacturing domain to apply compliance presets."}
                      {step === 1 && "Toggle the operational hubs active in your factory."}
                      {step === 2 && "Declare your shopfloor connectivity (Zero sensors vs IoT)."}
                      {step === 3 && "Set your root supervisor username and password."}
                      {step === 4 && "Review configuration and initialize the database."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {[0, 1, 2, 3, 4].map((s) => (
                    <div
                      key={s}
                      className={`h-1.5 rounded-full transition-all ${
                        s === step ? "w-8 bg-cyan-400" : s < step ? "w-3 bg-cyan-600/50" : "w-3 bg-white/10"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {step === 0 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/80 font-mono flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      Select Primary Industry Specification:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {INDUSTRIES.map((ind) => {
                        const Icon = ind.icon;
                        const isSelected = selectedIndustry === ind.id;
                        return (
                          <div
                            key={ind.id}
                            onClick={() => handleIndustrySelect(ind.id)}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                              isSelected
                                ? "bg-cyan-500/15 border-cyan-400 ring-1 ring-cyan-400/30 shadow-lg shadow-cyan-500/10"
                                : "bg-white/[0.02] hover:bg-white/[0.05] border-white/10"
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className={`p-2 rounded-xl ${isSelected ? "bg-cyan-500/30 text-cyan-200" : "bg-white/5 text-white/50"}`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                                  {ind.standard.split(" ")[0]}
                                </span>
                              </div>
                              <div>
                                <h3 className="text-xs font-extrabold text-white">{ind.name}</h3>
                                <p className="text-[10px] text-cyan-300 font-mono">{ind.standard}</p>
                              </div>
                              <p className="text-[11px] text-white/50 line-clamp-2 leading-relaxed">{ind.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/[0.02] p-5 rounded-2xl border border-white/10">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-bold text-white/80 font-mono">Company / Plant Legal Name *</label>
                      <Input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="E.g. Precision Aerospace Dynamics Pvt Ltd"
                        className="bg-black/40 border-white/15 text-white text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white/80 font-mono">GSTIN / Tax ID</label>
                      <Input
                        value={companyGstin}
                        onChange={(e) => setCompanyGstin(e.target.value)}
                        placeholder="33AAAAA0000A1Z5"
                        className="bg-black/40 border-white/15 text-white text-xs font-mono uppercase"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white/80 font-mono">Primary Currency</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c} className="bg-[#0c1024]">
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  {/* Top Bar: Counter + Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                    <span className="text-xs font-mono text-white/70">
                      Selected Departments: <strong className="text-cyan-300">{selectedDepts.size} of {customDeptsList.length} Active</strong>
                    </span>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowAddDept(!showAddDept)}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add Custom Department</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSelectAllDepts}
                        className="text-xs font-bold text-cyan-400 hover:underline cursor-pointer font-mono"
                      >
                        Select All
                      </button>

                      <span className="text-white/20">|</span>

                      <button
                        type="button"
                        onClick={handleDeselectAllDepts}
                        className="text-xs font-bold text-white/50 hover:text-white cursor-pointer font-mono"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Add Custom Department Form Drawer */}
                  {showAddDept && (
                    <form onSubmit={handleAddCustomDept} className="p-4 rounded-2xl bg-blue-950/30 border border-cyan-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-cyan-300 uppercase">Add New Custom Department / Cell</span>
                        <button type="button" onClick={() => setShowAddDept(false)} className="text-xs text-white/50 hover:text-white">Cancel</button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          value={newDeptTitle}
                          onChange={(e) => setNewDeptTitle(e.target.value)}
                          placeholder="Department Title (e.g. 5-Axis Titanium Cell, Foundry)"
                          className="h-9 rounded-xl bg-black/50 border border-white/20 px-3 text-xs text-white placeholder:text-white/40"
                          autoFocus
                        />
                        <input
                          value={newDeptDesc}
                          onChange={(e) => setNewDeptDesc(e.target.value)}
                          placeholder="Scope (e.g. Titanium Blisks & Turbine Rings)"
                          className="h-9 rounded-xl bg-black/50 border border-white/20 px-3 text-xs text-white placeholder:text-white/40"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-xl bg-cyan-400 text-black font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to My Factory</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Department Cards Grid with Inline Rename & Delete */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[380px] overflow-y-auto pr-1">
                    {customDeptsList.map((d) => {
                      const isChecked = selectedDepts.has(d.id);
                      const isEditing = editingDeptId === d.id;

                      return (
                        <div
                          key={d.id}
                          onClick={() => {
                            if (isEditing) return;
                            const next = new Set(selectedDepts);
                            if (isChecked) next.delete(d.id);
                            else next.add(d.id);
                            setSelectedDepts(next);
                            soundFx.playClick();
                          }}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 group relative ${
                            isChecked
                              ? "bg-cyan-500/15 border-cyan-400/80 text-white shadow-md shadow-cyan-500/10"
                              : "bg-white/[0.02] hover:bg-white/[0.05] border-white/10 text-white/50"
                          }`}
                        >
                          {/* Header: Title or Rename Input */}
                          <div className="flex items-start justify-between gap-2">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5 flex-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  value={editingDeptTitle}
                                  onChange={(e) => setEditingDeptTitle(e.target.value)}
                                  className="h-7 rounded-lg bg-black/70 border border-cyan-400 px-2 text-xs text-white flex-1"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveRename(d.id)}
                                  className="px-2 py-1 rounded-md bg-cyan-400 text-black text-[10px] font-bold"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-extrabold text-white">{d.title}</span>
                              </div>
                            )}

                            {/* Checkbox indicator */}
                            <div className={`w-4 h-4 rounded-md shrink-0 flex items-center justify-center mt-0.5 ${isChecked ? "bg-cyan-400 text-black" : "border border-white/20"}`}>
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>

                          <p className="text-[11px] text-white/50 line-clamp-2 leading-tight">{d.desc}</p>

                          {/* Footer Actions: Inline Rename & Remove */}
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10 opacity-70 group-hover:opacity-100 transition-opacity text-[10px] font-mono">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingDeptId(d.id);
                                setEditingDeptTitle(d.title);
                              }}
                              className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/15 text-cyan-300 border border-white/10 flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                              <span>Rename</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveDept(d.id, d.title);
                              }}
                              className="px-2 py-0.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              <span>Remove</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <label className="text-xs font-bold text-white/80 font-mono">
                    Select Your Factory Operational Mode:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div
                      onClick={() => {
                        setInfraMode("ZERO_SENSOR");
                        soundFx.playClick();
                        speakText("Zero sensor mode selected. AI will operate using digital shopfloor tablets, CAD files, and traveler logs.");
                      }}
                      className={`p-5 rounded-3xl border transition-all cursor-pointer space-y-3 ${
                        infraMode === "ZERO_SENSOR"
                          ? "bg-cyan-500/15 border-cyan-400 ring-1 ring-cyan-400/40 shadow-lg shadow-cyan-500/15"
                          : "bg-white/[0.02] hover:bg-white/[0.05] border-white/10"
                      }`}
                    >
                      <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-300 w-fit">
                        <Terminal className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm text-white">Traditional Workshop (Zero Sensors)</h3>
                        <p className="text-xs text-cyan-300 font-mono mt-0.5">Paperless Tablets & Digital Travelers</p>
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">
                        Best for CNC machine shops with legacy machines. AI operates on manual micrometer entries, barcode job clock-ins, 3D CAD uploads, and supplier challans with zero hardware cost.
                      </p>
                    </div>

                    <div
                      onClick={() => {
                        setInfraMode("SMART_IOT");
                        soundFx.playClick();
                        speakText("Smart IoT mode selected. AI will ingest live vibration, thermal, and smart power meter feeds.");
                      }}
                      className={`p-5 rounded-3xl border transition-all cursor-pointer space-y-3 ${
                        infraMode === "SMART_IOT"
                          ? "bg-indigo-500/15 border-indigo-400 ring-1 ring-indigo-400/40 shadow-lg shadow-indigo-500/15"
                          : "bg-white/[0.02] hover:bg-white/[0.05] border-white/10"
                      }`}
                    >
                      <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 w-fit">
                        <Cpu className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm text-white">Industry 4.0 Smart Factory</h3>
                        <p className="text-xs text-indigo-300 font-mono mt-0.5">Live Sensors, Modbus & Power Meters</p>
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">
                        Best for automated cells with live vibration sensors, energy sub-meters, and PLC gateways. AI runs real-time Weibull degradation and automatic peak-tariff power clamping.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 bg-white/[0.02] p-5 rounded-2xl border border-white/10">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-cyan-300 font-mono uppercase">Master Administrator Setup</h3>
                    <p className="text-xs text-white/50">This account has full root ownership over all configured departments, custom roles, settings, and audit logs.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white/80 font-mono">Full Name *</label>
                      <Input
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        placeholder="E.g. Mahesh V (Chief Operating Officer)"
                        className="bg-black/40 border-white/15 text-white text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white/80 font-mono">Username *</label>
                      <Input
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        placeholder="admin"
                        className="bg-black/40 border-white/15 text-white text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white/80 font-mono">Work Email</label>
                      <Input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@factory.com"
                        className="bg-black/40 border-white/15 text-white text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white/80 font-mono">Master Password *</label>
                      <Input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-black/40 border-white/15 text-white text-xs"
                      />
                    </div>
                  </div>

                  {/* Operator quick login */}
                  <div className="pt-4 mt-2 border-t border-white/10">
                    <h4 className="text-xs font-bold text-white/70 font-mono">Default Operator Login (Optional)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <Input
                        value={operatorName}
                        onChange={(e) => setOperatorName(e.target.value)}
                        placeholder="Operator Name"
                        className="bg-black/40 border-white/15 text-white text-xs"
                      />
                      <Input
                        value={operatorUsername}
                        onChange={(e) => setOperatorUsername(e.target.value)}
                        placeholder="operator (Username)"
                        className="bg-black/40 border-white/15 text-white text-xs font-mono"
                      />
                      <Input
                        type="password"
                        value={operatorPassword}
                        onChange={(e) => setOperatorPassword(e.target.value)}
                        placeholder="1234 (Password)"
                        className="bg-black/40 border-white/15 text-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5 bg-white/[0.02] p-6 rounded-3xl border border-cyan-500/30 text-center">
                  <div className="w-16 h-16 rounded-full bg-cyan-500/20 border border-cyan-400/40 mx-auto flex items-center justify-center text-cyan-300">
                    <Rocket className="w-8 h-8 animate-pulse" />
                  </div>

                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="text-base font-black text-white">Ready for Factory Initialization</h3>
                    <p className="text-xs text-white/60">
                      AURA will now configure the 184 database tables, lock offline security credentials, and calibrate the 12 AI co-pilot agents.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-left space-y-2 max-w-md mx-auto text-xs font-mono">
                    <div className="flex justify-between text-white/70">
                      <span>Enterprise:</span>
                      <span className="text-cyan-300 font-bold">{companyName || "My Plant"}</span>
                    </div>
                    <div className="flex justify-between text-white/70">
                      <span>Industry Profile:</span>
                      <span className="text-indigo-300 font-bold">{INDUSTRIES.find((i) => i.id === selectedIndustry)?.name}</span>
                    </div>
                    <div className="flex justify-between text-white/70">
                      <span>Active Modules:</span>
                      <span className="text-purple-300 font-bold">{selectedDepts.size} Departments</span>
                    </div>
                    <div className="flex justify-between text-white/70">
                      <span>Infra Mode:</span>
                      <span className="text-emerald-300 font-bold">{infraMode === "ZERO_SENSOR" ? "Zero Sensors (Tablets)" : "Smart IoT Connected"}</span>
                    </div>
                  </div>

                  <div className="max-w-md mx-auto text-left pt-2">
                    <label className="flex items-center gap-2 text-xs font-mono text-white/80 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={loadSample}
                        onChange={(e) => setLoadSample(e.target.checked)}
                        className="rounded accent-cyan-400"
                      />
                      <span>Seed with sample industry demo data (Parts, machines, work orders)</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <button
                  disabled={step === 0 || busy}
                  onClick={() => {
                    setStep((s) => s - 1);
                    soundFx.playClick();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold transition-all border border-white/10 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  disabled={busy}
                  onClick={handleNextStep}
                  className="px-7 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-extrabold shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 border border-cyan-400/30"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Configuring with AURA...</span>
                    </>
                  ) : (
                    <>
                      <span>{step === 4 ? "Launch Factory Core" : "Next Step"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {introPhase === "launching" && (
            <motion.div
              key="launching"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full text-center space-y-6 max-w-lg mx-auto py-12"
            >
              <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-cyan-500 animate-ping opacity-30" />
                <div className="relative w-20 h-20 rounded-full bg-[#070913] border-2 border-cyan-400 flex items-center justify-center shadow-2xl">
                  <Bot className="w-10 h-10 text-cyan-300 animate-pulse" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white">Initializing Factory Nervous System...</h2>
                <p className="text-xs text-cyan-300 font-mono">{launchLog}</p>
              </div>

              <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/10">
                <div
                  className="bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300 shadow-lg shadow-cyan-500/50"
                  style={{ width: `${launchProgress}%` }}
                />
              </div>

              <span className="text-xs font-mono text-white/50">{launchProgress}% Completed</span>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
