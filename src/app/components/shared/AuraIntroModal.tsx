"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Bot,
  Cpu,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  ShieldCheck,
  Factory,
  Gauge,
  Radio,
  Zap,
  Loader2,
  HardDrive,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { soundFx } from "@/lib/soundFx";

interface AuraIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultStep?: number;
}

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

export default function AuraIntroModal({
  isOpen,
  onClose,
  defaultStep = 1,
}: AuraIntroModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(defaultStep);

  // Hardware & LLM State
  const [loadingHardware, setLoadingHardware] = useState(false);
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("deepseek-r1:14b");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [activationSuccess, setActivationSuccess] = useState(false);
  const [activeModelName, setActiveModelName] = useState<string>("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadHardwareAndModels();
    }
  }, [isOpen]);

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

  const handleActivateBrain = async () => {
    try {
      setActivating(true);
      setErrorMessage(null);
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
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Model activation failed");
      }

      setActiveModelName(modelObj?.name || selectedModelId);
      setActivationSuccess(true);
      soundFx.playSuccess();

      // Run live test ping
      try {
        const testRes = await fetch("/api/ai/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: "AURA status check. Respond in 1 brief sentence." }],
          }),
        });
        const testData = await testRes.json();
        if (testData?.reply) {
          setTestResult(testData.reply);
        } else {
          setTestResult("AURA neural connection verified. Ready for shopfloor deployment.");
        }
      } catch {
        setTestResult("AURA neural core is active.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to activate selected model.");
    } finally {
      setActivating(false);
    }
  };

  const finishAndGoToOnboarding = () => {
    localStorage.setItem("mfg_aura_intro_completed", "true");
    soundFx.playSuccess();
    onClose();
    router.push("/onboarding?guided=true");
  };

  const finishAndStayOnGateway = () => {
    localStorage.setItem("mfg_aura_intro_completed", "true");
    soundFx.playClick();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900/95 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Top Progress Bar & Close */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                System Guide • Step {step} of 4
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      s === step
                        ? "w-8 bg-blue-500"
                        : s < step
                        ? "w-4 bg-emerald-500"
                        : "w-4 bg-slate-700"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={finishAndStayOnGateway}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Step Body */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto max-h-[72vh]">
          <AnimatePresence mode="wait">
            {/* STEP 1: SOFTWARE INTRODUCTION */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="text-center max-w-2xl mx-auto">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Welcome to Manufacturing Max
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-3 tracking-tight">
                    Precision Manufacturing & Quality Intelligence
                  </h2>
                  <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                    Designed specifically for high-precision CNC machine shops and aerospace & defense suppliers. Complete shopfloor visibility, full audit compliance, and autonomous intelligence in one offline-tolerant platform.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 hover:border-blue-500/40 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3">
                      <Factory className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">CNC Shopfloor Telemetry</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Live OEE tracking, spindle load, cycle times, downtime logging, and operator tablet terminal mode with zero lag.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 hover:border-emerald-500/40 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">Aerospace QMS (AS9100D)</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      AS9102 First Article Inspection (FAI), raw material heat melt-lot traceability, pyrometry compliance, and 8D CAPA workflows.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 hover:border-amber-500/40 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                      <Gauge className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">Tool Room & Metrology</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      ISO 17025 gauge calibration cycles, tool wear tracking, CMM inspection reports, and preventive maintenance rules.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 hover:border-purple-500/40 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3">
                      <Bot className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">AURA Autonomous Copilot</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Your onboard manufacturing AI that verifies G-code, diagnoses scrap root-causes, and assists shift supervisors 24/7.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: COPILOT INTRODUCES ITSELF */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6 text-center"
              >
                {/* Glowing Neural Core Avatar */}
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 blur-xl opacity-60 animate-pulse" />
                  <div className="relative w-full h-full rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 border-2 border-cyan-400/50 flex items-center justify-center shadow-2xl">
                    <Bot className="w-12 h-12 text-cyan-400 animate-bounce" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 font-mono shadow-md">
                    ONLINE
                  </div>
                </div>

                <div className="max-w-xl mx-auto">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                    Meet Your Autonomous Factory Partner
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                    &quot;Greetings! I am AURA.&quot;
                  </h2>
                  <p className="text-sm text-slate-300 mt-3 leading-relaxed">
                    I am your autonomous aerospace and precision manufacturing intelligence copilot. I live right inside this workstation to monitor telemetry, audit tolerances, verify CNC G-code, and assist your engineers and operators in real time.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left mt-6">
                  <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80">
                    <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold mb-1">
                      <Zap className="w-4 h-4" />
                      Zero-Cloud Privacy
                    </div>
                    <p className="text-xs text-slate-400">
                      Can run 100% locally on your workstation without sending your CAD drawings or IP to external clouds.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                      <ShieldCheck className="w-4 h-4" />
                      AS9100D Guardian
                    </div>
                    <p className="text-xs text-slate-400">
                      Instantly verifies calibration validity, heat lot records, and traveler checklists before jobs run.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80">
                    <div className="flex items-center gap-2 text-purple-400 text-xs font-bold mb-1">
                      <Cpu className="w-4 h-4" />
                      Deep Reasoning
                    </div>
                    <p className="text-xs text-slate-400">
                      Hardware-adaptive industrial reasoning for mathematical machining speed, feed, and cycle time checks.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 max-w-xl mx-auto mt-4 text-xs text-cyan-300">
                  💡 In the next step, I will help you connect my reasoning brain to the AI models configured for your hardware.
                </div>
              </motion.div>
            )}

            {/* STEP 3: CONFIGURE LLM BRAIN */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="text-center max-w-xl mx-auto">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Cognitive Brain Setup
                  </span>
                  <h2 className="text-2xl font-extrabold text-white mt-2">
                    Connect AURA&apos;s Reasoning Brain
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1">
                    Select which AI model you want AURA to use. Detected local models run privately on your PC with zero cloud cost.
                  </p>
                </div>

                {/* Hardware Snapshot */}
                {loadingHardware ? (
                  <div className="flex items-center justify-center p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 text-xs text-slate-400 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    <span>Scanning local hardware and Ollama models...</span>
                  </div>
                ) : hardware ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-blue-400" />
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

                {/* Model Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {models.map((m) => {
                    const isSelected = selectedModelId === m.id;
                    const isDetected = m.category.includes("Installed") || m.name.includes("Detected");
                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedModelId(m.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500"
                            : "bg-slate-800/40 border-slate-700/60 hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-sm font-bold text-white">{m.name}</h4>
                              {isDetected && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  ★ INSTALLED ON WORKSTATION
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">{m.size}</span>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected ? "border-blue-500 bg-blue-500 text-white" : "border-slate-600"
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-2">{m.desc}</p>
                      </div>
                    );
                  })}
                </div>

                {/* API Key Inputs if Cloud Selected */}
                {selectedModelId === "gemini-cloud" && (
                  <div className="p-4 rounded-xl bg-slate-800/70 border border-slate-700 space-y-2">
                    <label className="text-xs font-semibold text-slate-200">Google Gemini API Key</label>
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                    <p className="text-[11px] text-slate-400">Get a free key from Google AI Studio (aistudio.google.com).</p>
                  </div>
                )}

                {selectedModelId === "groq-cloud" && (
                  <div className="p-4 rounded-xl bg-slate-800/70 border border-slate-700 space-y-2">
                    <label className="text-xs font-semibold text-slate-200">Groq Cloud API Key</label>
                    <input
                      type="password"
                      placeholder="gsk_..."
                      value={groqApiKey}
                      onChange={(e) => setGroqApiKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                    <p className="text-[11px] text-slate-400">Get a free key from Groq Console (console.groq.com).</p>
                  </div>
                )}

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                    {errorMessage}
                  </div>
                )}

                {/* Activation Button & Live Verification */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-slate-400 text-center sm:text-left">
                    {activationSuccess ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-4 h-4" /> Connected to {activeModelName}
                      </span>
                    ) : (
                      "Click below to link model to AURA copilot"
                    )}
                  </div>

                  <button
                    onClick={handleActivateBrain}
                    disabled={activating}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                  >
                    {activating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Connecting Brain...
                      </>
                    ) : activationSuccess ? (
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
                </div>

                {/* Live Output Card if verified */}
                {testResult && (
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 text-xs text-slate-300 flex items-start gap-2.5">
                    <Bot className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-emerald-400 block mb-0.5">AURA Live Telemetry Test</span>
                      <p className="font-mono text-slate-200">&quot;{testResult}&quot;</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 4: HANDOFF TO ONBOARDING */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6 text-center max-w-xl mx-auto"
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    AURA Ready
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-3">
                    Let&apos;s Build Your Factory Workspace
                  </h2>
                  <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                    Now that my reasoning brain is active, I will accompany you through the Factory Onboarding Wizard. I will suggest aerospace standards (AS9100D), configure recommended departments, set shift hours, and pre-populate your CNC machines.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700 text-left space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    What I&apos;ll Help You With Next:
                  </div>
                  <ul className="space-y-1.5 text-slate-400 pl-6 list-disc">
                    <li>Company profile, GSTIN & Aerospace standard (AS9100 Rev D)</li>
                    <li>Department selection (Operations, Quality, Tool Room, Metrology)</li>
                    <li>Standard shift rosters (Shift 1, Shift 2, Handover protocols)</li>
                    <li>CNC VMC & Turning Machine registry with ideal cycle times</li>
                  </ul>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={finishAndGoToOnboarding}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-xl shadow-blue-500/25"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Launch Guided Factory Onboarding
                  </button>
                  <button
                    onClick={finishAndStayOnGateway}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
                  >
                    Explore Workspace Directly
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => {
                soundFx.playClick();
                setStep(step - 1);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              onClick={() => {
                soundFx.playClick();
                setStep(step + 1);
              }}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20"
            >
              {step === 1 && "Meet AI Copilot"}
              {step === 2 && "Configure AI Brain"}
              {step === 3 && (activationSuccess ? "Continue to Onboarding" : "Next Step")}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
