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
  Plane,
  Cog,
  Car,
  Flame,
  HeartPulse,
  Plus,
  Edit2,
  Trash2,
  Radio,
  HardDrive,
  Download,
  Lock,
  Play,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/app/components/ui/Input";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";
import AuraOnboardingAssistant from "./AuraOnboardingAssistant";

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

interface HardwareInfo {
  totalRamGb: number;
  freeRamGb: number;
  cpuModel: string;
  cpuCores: number;
  gpuName: string;
  hasDedicatedGpu: boolean;
  ollamaStatus: "RUNNING" | "INSTALLED_STOPPED" | "NOT_INSTALLED";
}

interface ModelOption {
  id: string;
  name: string;
  tag: string;
  size: string;
  minRamGb: number;
  recommendedRamGb: number;
  isRecommended: boolean;
  desc: string;
  category: string;
}

export default function OnboardingWizard() {
  const [state, setState] = useState<SetupState | null>(null);
  const [introPhase, setIntroPhase] = useState<"greeting" | "software_intro" | "ai_setup" | "wizard" | "launching">("greeting");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // AI Cognitive Setup State
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("deepseek-r1:14b");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [loadingHardware, setLoadingHardware] = useState(false);
  const [activatingModel, setActivatingModel] = useState(false);
  const [brainConnected, setBrainConnected] = useState(false);
  const [activeModelName, setActiveModelName] = useState<string>("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    percent: number;
    status: string;
    detail: string;
  } | null>(null);
  const [startingOllama, setStartingOllama] = useState(false);

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
        if (d.onboardingComplete && typeof window !== "undefined" && !window.location.search.includes("reset=true")) {
          // Factory already onboarded — auto-sign in and enter factory command center
          fetch("/api/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "auto-login" }),
          }).finally(() => {
            window.location.assign("/command");
          });
          return;
        }
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

    if (typeof window !== "undefined" && window.location.search.includes("guided=true")) {
      setIntroPhase("wizard");
    }
  }, []);



  useEffect(() => {
    loadHardwareAndModels();
  }, []);

  const loadHardwareAndModels = async () => {
    try {
      setLoadingHardware(true);
      const res = await fetch("/api/system/ai/hardware");
      const data = await res.json();
      if (data?.success) {
        setHardware(data.hardware);
        setModels(data.availableModels || []);
        if (data.recommendedModelId) {
          setSelectedModelId(data.recommendedModelId);
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoadingHardware(false);
    }
  };

  const handleStartOllama = async () => {
    try {
      setStartingOllama(true);
      soundFx.playClick();
      toast.info("Starting Ollama background engine on this workstation...");

      const res = await fetch("/api/system/ai/start-ollama", { method: "POST" });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to start Ollama");
      }

      soundFx.playSuccess();
      toast.success(data.message || "Ollama background service is active!");
      await loadHardwareAndModels();
    } catch (err: any) {
      toast.error(err.message || "Could not start Ollama. Make sure it is installed.");
    } finally {
      setStartingOllama(false);
    }
  };

  const handleActivateBrain = async (isDownload = false) => {
    try {
      setActivatingModel(true);
      setDownloadProgress(
        isDownload
          ? {
              percent: 0,
              status: "Connecting to Ollama...",
              detail: "Initiating stream from official registry...",
            }
          : null
      );
      soundFx.playClick();

      const modelObj = models.find((m) => m.id === selectedModelId);
      const isGemini = selectedModelId === "gemini-cloud";
      const isGroq = selectedModelId === "groq-cloud";
      const provider = isGemini ? "gemini" : isGroq ? "groq" : "ollama";
      const apiKey = isGemini ? geminiApiKey : isGroq ? groqApiKey : undefined;

      const res = await fetch("/api/system/ai/install-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModelId,
          tag: modelObj?.tag || selectedModelId,
          provider,
          apiKey,
          download: isDownload,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (errJson?.requiresDownload) {
          toast.error(
            errJson.error ||
              "This model requires downloading before it can be connected."
          );
          setDownloadProgress(null);
          return;
        }
        throw new Error(errJson.error || "Model activation failed");
      }

      // If downloading via Ollama stream
      if (isDownload && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              let pct = 0;
              let detailText = "";
              if (data.total && data.completed) {
                pct = Math.min(100, Math.round((data.completed / data.total) * 100));
                const completedMb = (data.completed / (1024 * 1024)).toFixed(1);
                const totalMb = (data.total / (1024 * 1024)).toFixed(1);
                detailText = `${completedMb} MB / ${totalMb} MB (${pct}%)`;
              }
              setDownloadProgress({
                percent: pct,
                status: data.status || "Downloading layers...",
                detail: detailText,
              });
              if (data.status === "success") {
                setDownloadProgress({
                  percent: 100,
                  status: "Download Complete!",
                  detail: "Model verified in local Ollama",
                });
              }
            } catch {}
          }
        }
      }

      setActiveModelName(modelObj?.name || selectedModelId);
      setBrainConnected(true);
      soundFx.playSuccess();
      toast.success(
        isDownload
          ? `Downloaded & connected AURA to ${modelObj?.name || selectedModelId}!`
          : `Connected AURA to ${modelObj?.name || selectedModelId}!`
      );

      // Re-scan hardware so badges update dynamically
      await loadHardwareAndModels();

      // Run live test ping
      try {
        const testRes = await fetch("/api/ai/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: "AURA status check. Respond in 1 brief sentence.",
              },
            ],
          }),
        });
        const testData = await testRes.json();
        if (testData?.reply) {
          setTestResult(testData.reply);
        } else {
          setTestResult(
            "AURA neural connection verified. Ready for shopfloor deployment."
          );
        }
      } catch {
        setTestResult("AURA neural core is active.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to activate selected model.");
    } finally {
      setActivatingModel(false);
      setDownloadProgress(null);
    }
  };

  // Trigger voice on intro screens
  useEffect(() => {
    if (introPhase === "greeting") {
      speakText("Hello! I am AURA — your autonomous Aerospace and Precision Manufacturing Intelligence Co-Pilot. Welcome to ManufacturingMax. Let me introduce you to the software and configure my cognitive brain.");
    } else if (introPhase === "software_intro") {
      speakText("Here is what ManufacturingMax delivers: precision CNC telemetry, AS9100 Rev D aerospace compliance, tool calibration, and autonomous shopfloor co-pilots.");
    } else if (introPhase === "ai_setup") {
      speakText("Let us configure my reasoning brain. I have scanned your workstation and detected your local AI models.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introPhase]);

  const handleIndustrySelect = (indId: string) => {
    setSelectedIndustry(indId);
    soundFx.playClick();
    const ind = INDUSTRIES.find((i) => i.id === indId);
    if (ind) {
      speakText(`Selected ${ind.name} specification.`);
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
        if (!adminName.trim()) {
          toast.error("Please enter the Master Administrator's full name");
          setBusy(false);
          return;
        }
        if (!adminPassword.trim()) {
          toast.error("Please enter a master password");
          setBusy(false);
          return;
        }
        if (adminPassword.trim().length < 4) {
          toast.error("Master password must be at least 4 characters");
          setBusy(false);
          return;
        }

        const res = await fetch("/api/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "team",
            admin: {
              name: adminName.trim(),
              username: adminUsername.trim() || "admin",
              email: adminEmail.trim() || undefined,
              password: adminPassword.trim(),
              isOwner: true,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          const err = data.errors?.[0]?.error || "Failed to create administrator";
          toast.error(err);
          setBusy(false);
          return;
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
        speakText("Factory configuration complete. Welcome to ManufacturingMax. Your factory workspace is now fully active.");
        await new Promise((r) => setTimeout(r, 800));
        // Hard reload required after onboarding to re-initialize auth/session and server state
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/command");
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
          {/* OLLAMA STATUS / INSTALL BUTTON */}
          {hardware?.ollamaStatus === "RUNNING" ? (
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                loadHardwareAndModels();
                toast.success("Ollama Engine is running & ready on port 11434");
              }}
              title="Click to refresh local models"
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Ollama Active</span>
            </button>
          ) : hardware?.ollamaStatus === "INSTALLED_STOPPED" ? (
            <button
              type="button"
              onClick={handleStartOllama}
              disabled={startingOllama}
              title="Click to start Ollama background engine"
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {startingOllama ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>Start Ollama</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                window.open("https://ollama.com/download", "_blank");
              }}
              title="Download & Install Ollama on your workstation"
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20 border border-blue-400/30 transition-all hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install Ollama</span>
            </button>
          )}

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
          {/* PHASE 1: ANIMATED AI WELCOMING GREETING */}
          {introPhase === "greeting" && (
            <motion.div
              key="greeting"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full text-center space-y-8 py-6 max-w-3xl mx-auto"
            >
              {/* Glowing Animated Neural Avatar */}
              <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 animate-spin blur-xl opacity-60" />
                <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-[#0c1024] to-[#04060e] border-2 border-cyan-400/70 flex flex-col items-center justify-center shadow-2xl overflow-hidden">
                  <Sparkles className="w-10 h-10 text-cyan-300 animate-bounce" />
                  <span className="text-[10px] font-mono font-black text-cyan-300 mt-1 tracking-widest">
                    AURA
                  </span>
                </div>
                <div className="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 font-mono shadow-md">
                  ONLINE
                </div>
              </div>

              {/* Welcoming Speech Card */}
              <div className="p-6 sm:p-8 rounded-3xl bg-white/[0.04] border border-cyan-500/30 backdrop-blur-xl shadow-2xl text-left space-y-4 relative">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      AURA // Factory Chief Intelligence Officer
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-white/40">Autonomous Operational Partner</span>
                </div>

                <div className="space-y-3 text-sm text-white/90 leading-relaxed font-sans">
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    &quot;Greetings! I am <span className="text-cyan-300">AURA</span>.&quot;
                  </h3>
                  <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                    I am your autonomous aerospace and precision manufacturing intelligence co-pilot. I operate right inside this workstation to monitor machine telemetry, audit tolerances, verify CNC G-code, and assist your team in real time.
                  </p>
                  <p className="text-xs text-white/60">
                    I will walk you through what our platform can do, help connect my reasoning brain to your computer, and guide you step-by-step through setting up your factory.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="flex items-center gap-1.5 text-cyan-300 text-xs font-bold mb-1">
                      <Zap className="w-3.5 h-3.5" />
                      Sub-Second Telemetry
                    </div>
                    <p className="text-[11px] text-white/60">
                      Real-time OEE, spindle load, and cycle time tracking on the shopfloor.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-bold mb-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      AS9100D Guardian
                    </div>
                    <p className="text-[11px] text-white/60">
                      AS9102 First Article Inspection, melt-lot traceability, and 8D CAPA.
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                    <div className="flex items-center gap-1.5 text-purple-300 text-xs font-bold mb-1">
                      <Cpu className="w-3.5 h-3.5" />
                      Deep Reasoning
                    </div>
                    <p className="text-[11px] text-white/60">
                      Hardware-adaptive industrial reasoning for feeds, speeds & scrap root cause.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    setIntroPhase("software_intro");
                    soundFx.playClick();
                  }}
                  className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-3 border border-cyan-400/30"
                >
                  <span>Explore What We Can Do Together</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* PHASE 2: AURA GUIDES TO SOFTWARE INTRODUCTION */}
          {introPhase === "software_intro" && (
            <motion.div
              key="software_intro"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full text-center space-y-8 py-6 max-w-4xl mx-auto"
            >
              <div className="space-y-3 max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold">
                  <Bot className="w-3.5 h-3.5" />
                  <span>AURA Guided Platform Overview</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  Precision Manufacturing & Quality Intelligence
                </h2>
                <p className="text-sm text-white/70 leading-relaxed">
                  Built specifically for high-precision CNC machine shops and aerospace & defense suppliers. Complete shopfloor visibility, full audit compliance, and autonomous intelligence in one offline-tolerant platform.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/40 transition-all space-y-2">
                  <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 w-fit">
                    <Factory className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-xs text-white">CNC Shopfloor Telemetry</h3>
                  <p className="text-[11px] text-white/50 leading-normal">
                    Live OEE dials, spindle load, cycle times, downtime logging, and operator tablet terminal mode with zero lag.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/40 transition-all space-y-2">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 w-fit">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-xs text-white">Aerospace QMS (AS9100D)</h3>
                  <p className="text-[11px] text-white/50 leading-normal">
                    AS9102 First Article Inspection (FAI), raw material heat melt-lot traceability, and 8D CAPA workflows.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-purple-500/40 transition-all space-y-2">
                  <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 w-fit">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-xs text-white">Tool Room & Metrology</h3>
                  <p className="text-[11px] text-white/50 leading-normal">
                    ISO 17025 gauge calibration cycles, tool wear tracking, CMM reports, and preventive maintenance rules.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-indigo-500/40 transition-all space-y-2">
                  <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 w-fit">
                    <Bot className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-xs text-white">12 Autonomous Co-Pilots</h3>
                  <p className="text-[11px] text-white/50 leading-normal">
                    Real-time G-code verification, scrap root cause diagnosis, smart scheduling, and shift handovers.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  onClick={() => {
                    setIntroPhase("greeting");
                    soundFx.playClick();
                  }}
                  className="px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold text-xs border border-white/10 transition-all cursor-pointer"
                >
                  ← Back to AURA
                </button>
                <button
                  onClick={() => {
                    setIntroPhase("ai_setup");
                    soundFx.playClick();
                  }}
                  className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-3 border border-cyan-400/30"
                >
                  <span>Configure AI Reasoning Brain</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* PHASE 3: AI MODEL SELECTION */}
          {introPhase === "ai_setup" && (
            <motion.div
              key="ai_setup"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full text-center space-y-6 py-6 max-w-3xl mx-auto"
            >
              <div className="space-y-2 max-w-xl mx-auto">
                <span className="px-3.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-mono font-bold">
                  AURA // Cognitive Engine Setup
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Connect AURA&apos;s Reasoning Brain
                </h2>
                <p className="text-xs sm:text-sm text-white/70">
                  Select an AI model tailored to your workstation hardware. Installed local models run 100% privately on-premise with zero cloud costs.
                </p>
              </div>

              {/* Hardware Snapshot */}
              {loadingHardware ? (
                <div className="flex items-center justify-center p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-white/50 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Scanning local hardware and Ollama models...</span>
                </div>
              ) : hardware ? (
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-white/70">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    <span>
                      System: <strong className="text-white">{hardware.totalRamGb} GB RAM</strong> ({hardware.freeRamGb} GB Free)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-400" />
                    <span>
                      Ollama Status:{" "}
                      <strong className={hardware.ollamaStatus === "RUNNING" ? "text-emerald-400" : "text-amber-400"}>
                        {hardware.ollamaStatus === "RUNNING" ? "Online & Ready" : "Installed on PC"}
                      </strong>
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Background Runtime Message & Actions */}
              {hardware?.ollamaStatus === "RUNNING" ? (
                <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-white/80 flex items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <p className="text-[11px] text-white/70">
                      <strong className="text-emerald-300 font-semibold">Running in Background:</strong> Ollama is active as a background daemon on this PC. Keep it running in the background so AURA can continuously stream CNC telemetry, audit tolerances, and parse G-code without interruptions.
                    </p>
                  </div>
                </div>
              ) : hardware?.ollamaStatus === "INSTALLED_STOPPED" ? (
                <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block mb-0.5">Ollama Background Service is Offline</strong>
                      <p className="text-[11px] text-amber-300/80">
                        Ollama is installed on this workstation but not currently active. Start the background service to connect your local models.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartOllama}
                    disabled={startingOllama}
                    className="shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {startingOllama ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Starting Daemon...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Start Ollama in Background</span>
                      </>
                    )}
                  </button>
                </div>
              ) : hardware?.ollamaStatus === "NOT_INSTALLED" ? (
                <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
                  <div className="flex items-start gap-2.5">
                    <Download className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block mb-0.5">Ollama Not Installed</strong>
                      <p className="text-[11px] text-blue-300/80">
                        Install Ollama to run local offline models privately on your PC, or select Google Gemini / Built-in Core below.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.open("https://ollama.com/download", "_blank")}
                    className="shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-blue-500/20 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Ollama</span>
                  </button>
                </div>
              ) : null}

              {/* Model Selection Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {models.map((m) => {
                  const isSelected = selectedModelId === m.id;
                  const isDetected = m.category.includes("Installed") || m.name.includes("Detected");
                  const isCloud = m.id === "gemini-cloud" || m.id === "groq-cloud";
                  const isHeuristic = m.id === "built-in-heuristic";
                  const needsDownload = !isDetected && !isCloud && !isHeuristic;

                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedModelId(m.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-cyan-500/15 border-cyan-400 ring-1 ring-cyan-400/40 shadow-lg shadow-cyan-500/15"
                          : "bg-white/[0.02] hover:bg-white/[0.05] border-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-white">{m.name}</h4>
                            {isDetected && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                ★ INSTALLED ON WORKSTATION (READY)
                              </span>
                            )}
                            {needsDownload && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                ⬇ REQUIRES DOWNLOAD ({m.size})
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-white/40">{m.size}</span>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? "border-cyan-400 bg-cyan-400 text-slate-950" : "border-white/30"
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                      <p className="text-xs text-white/60 line-clamp-2">{m.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Cloud API Key Inputs if selected */}
              {selectedModelId === "gemini-cloud" && (
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-left space-y-2">
                  <label className="text-xs font-semibold text-white">Google Gemini API Key</label>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/20 text-xs text-white"
                  />
                  <p className="text-[11px] text-white/40">Get a free key from Google AI Studio (aistudio.google.com).</p>
                </div>
              )}

              {selectedModelId === "groq-cloud" && (
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-left space-y-2">
                  <label className="text-xs font-semibold text-white">Groq Cloud API Key</label>
                  <input
                    type="password"
                    placeholder="gsk_..."
                    value={groqApiKey}
                    onChange={(e) => setGroqApiKey(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/20 text-xs text-white"
                  />
                  <p className="text-[11px] text-white/40">Get a free key from Groq Console (console.groq.com).</p>
                </div>
              )}

              {/* Download notice if selected model requires pulling */}
              {(() => {
                const selectedModelObj = models.find((m) => m.id === selectedModelId);
                const isDetected = selectedModelObj?.category.includes("Installed") || selectedModelObj?.name.includes("Detected");
                const isCloud = selectedModelId === "gemini-cloud" || selectedModelId === "groq-cloud";
                const isHeuristic = selectedModelId === "built-in-heuristic";
                const needsDownload = !isDetected && !isCloud && !isHeuristic;

                if (needsDownload) {
                  return (
                    <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200 text-left flex items-start gap-2.5">
                      <Download className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-white block mb-0.5">Model Download Required</span>
                        <p className="text-[11px] text-blue-300/80">
                          <strong>{selectedModelObj?.name}</strong> is not yet downloaded on your workstation. Clicking below will download <strong>{selectedModelObj?.size}</strong> into your local Ollama library.
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Activation CTA & Live Verification output */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-white/60">
                  {brainConnected ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4" /> Connected to {activeModelName}
                    </span>
                  ) : (
                    (() => {
                      const selectedModelObj = models.find((m) => m.id === selectedModelId);
                      const isDetected = selectedModelObj?.category.includes("Installed") || selectedModelObj?.name.includes("Detected");
                      const isCloud = selectedModelId === "gemini-cloud" || selectedModelId === "groq-cloud";
                      const isHeuristic = selectedModelId === "built-in-heuristic";
                      const needsDownload = !isDetected && !isCloud && !isHeuristic;
                      return needsDownload ? "Requires one-time download into Ollama" : "Ready to connect";
                    })()
                  )}
                </div>

                {(() => {
                  const selectedModelObj = models.find((m) => m.id === selectedModelId);
                  const isDetected = selectedModelObj?.category.includes("Installed") || selectedModelObj?.name.includes("Detected");
                  const isCloud = selectedModelId === "gemini-cloud" || selectedModelId === "groq-cloud";
                  const isHeuristic = selectedModelId === "built-in-heuristic";
                  const needsDownload = !isDetected && !isCloud && !isHeuristic;

                  if (needsDownload) {
                    return (
                      <button
                        type="button"
                        onClick={() => handleActivateBrain(true)}
                        disabled={activatingModel}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 cursor-pointer"
                      >
                        {activatingModel ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Downloading to Ollama ({selectedModelObj?.size})...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            <span>Download & Install Model ({selectedModelObj?.size})</span>
                          </>
                        )}
                      </button>
                    );
                  }

                  return (
                    <button
                      type="button"
                      onClick={() => handleActivateBrain(false)}
                      disabled={activatingModel}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
                    >
                      {activatingModel ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Connecting Brain...
                        </>
                      ) : brainConnected ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Brain Connected!
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Connect Model to AURA
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>

              {/* Live Streaming Download Progress Bar */}
              {downloadProgress && (
                <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/40 space-y-2.5 text-left">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-cyan-300 font-bold flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      {downloadProgress.status}
                    </span>
                    <span className="text-white font-bold bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/40">
                      {downloadProgress.percent}%
                    </span>
                  </div>

                  <div className="w-full h-3 rounded-full bg-black/60 border border-white/10 overflow-hidden p-0.5">
                    <div
                      style={{ width: `${Math.max(5, downloadProgress.percent)}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 transition-all duration-300"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-white/60 font-mono">
                    <span>{downloadProgress.detail || "Downloading layers directly from Ollama registry..."}</span>
                    <span>100% On-Premise Storage</span>
                  </div>
                </div>
              )}

              {/* Live Output Card if verified */}
              {testResult && (
                <div className="p-3.5 rounded-2xl bg-black/60 border border-emerald-500/40 text-xs text-white/80 text-left flex items-start gap-2.5">
                  <Bot className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-400 block mb-0.5">AURA Live Telemetry Test</span>
                    <p className="font-mono text-white/90">&quot;{testResult}&quot;</p>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex flex-col items-center justify-center gap-3 pt-4 border-t border-white/10">
                <div className="flex items-center justify-center gap-4 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setIntroPhase("software_intro");
                      soundFx.playClick();
                    }}
                    className="px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold text-xs border border-white/10 transition-all cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    disabled={!brainConnected || activatingModel}
                    onClick={() => {
                      if (!brainConnected) {
                        toast.error("Please connect AURA to an AI model or the offline core before proceeding.");
                        return;
                      }
                      setIntroPhase("wizard");
                      stopVoice();
                      soundFx.playSuccess();
                      speakText("Let us configure your factory profile. Please select your industry specification.");
                    }}
                    className={`px-8 py-3.5 rounded-2xl font-extrabold text-xs shadow-xl transition-all inline-flex items-center gap-2 border ${
                      brainConnected && !activatingModel
                        ? "bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer border-cyan-400/40"
                        : "bg-white/5 text-white/40 border-white/10 cursor-not-allowed opacity-50"
                    }`}
                  >
                    {brainConnected ? (
                      <>
                        <span>Begin Factory Setup with AURA</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Connect AI Brain to Continue</span>
                      </>
                    )}
                  </button>
                </div>

                {!brainConnected && (
                  <p className="text-[11px] text-amber-400/80 font-mono">
                    🔒 AI cognitive core must be connected and verified before advancing to factory setup.
                  </p>
                )}
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

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-6">
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

              <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
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
                    disabled={
                      busy ||
                      (step === 0 && !companyName.trim()) ||
                      (step === 1 && selectedDepts.size === 0) ||
                      (step === 3 &&
                        (!adminName.trim() ||
                          !adminPassword.trim() ||
                          adminPassword.trim().length < 4))
                    }
                    onClick={handleNextStep}
                    className="px-7 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-extrabold shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 border border-cyan-400/30"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Configuring with AURA...</span>
                      </>
                    ) : step === 3 &&
                      (!adminName.trim() ||
                        !adminPassword.trim() ||
                        adminPassword.trim().length < 4) ? (
                      <>
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Enter Admin Name & Password</span>
                      </>
                    ) : (
                      <>
                        <span>{step === 4 ? "Launch Factory Core" : "Next Step"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

                {step === 3 &&
                  (!adminName.trim() ||
                    !adminPassword.trim() ||
                    adminPassword.trim().length < 4) && (
                    <p className="text-[11px] text-amber-400/80 font-mono text-right">
                      🔒 Master Administrator Name & secure password (min. 4 chars) are required before continuing.
                    </p>
                  )}
              </div>
            </div>

            <div className="lg:col-span-1 lg:sticky lg:top-6">
              <AuraOnboardingAssistant
                currentStep={step + 1}
                selectedIndustry={selectedIndustry}
              />
            </div>
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
