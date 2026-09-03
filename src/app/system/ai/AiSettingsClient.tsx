"use client";

import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Activity,
  Cpu,
  CheckCircle2,
  Layers,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  Zap,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";

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

export default function AiSettingsClient() {
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("built-in-heuristic");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<number>(0);
  const [installStatus, setInstallStatus] = useState<string>("");
  const [activeConfig, setActiveConfig] = useState<any>(null);

  // Testing Inference State
  const [testing, setTesting] = useState(false);
  const [testResponse, setTestResponse] = useState<string | null>(null);

  const fetchHardwareAndModels = async () => {
    try {
      const res = await fetch("/api/system/ai/hardware");
      const data = await res.json();
      if (data?.success) {
        setHardware(data.hardware);
        setModels(data.availableModels || []);
      }

      const confRes = await fetch("/api/system/ai");
      const confData = await confRes.json();
      if (confData?.success && confData.config) {
        setActiveConfig(confData.config);
        if (confData.config.provider === "gemini") {
          setSelectedModelId("gemini-cloud");
          setGeminiApiKey(confData.config.apiKey || "");
        } else if (confData.config.provider === "groq") {
          setSelectedModelId("groq-cloud");
          setGroqApiKey(confData.config.apiKey || "");
        } else if (confData.config.provider === "heuristic") {
          setSelectedModelId("built-in-heuristic");
        } else if (confData.config.model) {
          setSelectedModelId(confData.config.model);
        }
      } else if (data?.recommendedModelId) {
        setSelectedModelId(data.recommendedModelId);
      }
    } catch (err) {
      logClientError("Failed to load hardware specs:", err, "AiSettingsClient");
    }
  };

  useEffect(() => {
    fetchHardwareAndModels();
  }, []);

  const handleActivateModel = async (targetModelId?: string) => {
    const modelToActivate = targetModelId || selectedModelId;
    setSelectedModelId(modelToActivate);
    setInstalling(true);
    setInstallProgress(20);
    setInstallStatus("Connecting to selected AI architecture...");
    soundFx.playClick();

    try {
      const isGemini = modelToActivate === "gemini-cloud";
      const isGroq = modelToActivate === "groq-cloud";
      const isHeuristic = modelToActivate === "built-in-heuristic";
      const modelObj = models.find((m) => m.id === modelToActivate);

      if (isGemini && !geminiApiKey.trim()) {
        toast.warning("Please enter your Google Gemini API key first.");
        setInstalling(false);
        return;
      }

      if (isGroq && !groqApiKey.trim()) {
        toast.warning("Please enter your Groq API key first.");
        setInstalling(false);
        return;
      }

      setTimeout(() => {
        setInstallProgress(60);
        setInstallStatus("Applying neural parameters and activating brain...");
      }, 400);

      const provider = isHeuristic
        ? "heuristic"
        : isGemini
          ? "gemini"
          : isGroq
            ? "groq"
            : "ollama";

      const apiKey = isGemini ? geminiApiKey : isGroq ? groqApiKey : undefined;

      const res = await fetch("/api/system/ai/install-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: modelToActivate,
          tag: modelObj?.tag || modelToActivate,
          provider,
          apiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Model activation failed");
      }

      setInstallProgress(100);
      setInstallStatus("AURA Neural Brain is Online and Ready!");
      soundFx.playSuccess();

      if (data.warning === "OLLAMA_OFFLINE") {
        toast.warning(data.message, 6000);
      } else {
        toast.success(data.message || `Activated ${modelObj?.name || modelToActivate}!`);
      }

      // Refresh config
      await fetchHardwareAndModels();

      // Automatically run a test query so the user immediately sees it working
      setTimeout(() => {
        runTestQuery();
      }, 500);
    } catch (err: any) {
      toast.error(err.message || "Failed to activate model");
      setInstallStatus("Error configuring brain: " + err.message);
    } finally {
      setTimeout(() => setInstalling(false), 1500);
    }
  };

  const runTestQuery = async () => {
    setTesting(true);
    setTestResponse(null);
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "AURA, run a quick status audit on our active CNC machines and Titanium stock.",
          contextDomain: "Executive Overview",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Inference test failed");
      setTestResponse(`[Engine: ${data.provider} // Model: ${data.model}]\n\n${data.response}`);
      soundFx.playSuccess();
    } catch (err: any) {
      setTestResponse(`Inference Note: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const isModelActive = (model: ModelOption) => {
    if (!activeConfig) return false;
    if (model.id === "built-in-heuristic" && (activeConfig.provider === "heuristic" || !activeConfig.provider)) {
      return true;
    }
    if (model.id === "gemini-cloud" && activeConfig.provider === "gemini") {
      return true;
    }
    if (model.id === "groq-cloud" && activeConfig.provider === "groq") {
      return true;
    }
    if (activeConfig.provider === "ollama" && (activeConfig.model === model.tag || activeConfig.model === model.id)) {
      return true;
    }
    return false;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner with Hardware Diagnosis */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-950/40 via-cyan-950/30 to-purple-950/40 border border-cyan-500/20 backdrop-blur-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold border border-cyan-500/30 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              <span>AURA CO-PILOT CONFIGURATION</span>
            </span>
            <span className="text-xs text-white/50 font-mono">1-CLICK INSTANT ACTIVATION</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            AI Neural Model & Hardware Architecture
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Select an AI brain below. The system will configure and connect it immediately to AURA Co-Pilot. Zero complex terminal commands required.
          </p>
        </div>

        {/* Live Hardware Specs Card */}
        {hardware && (
          <div className="p-4 rounded-2xl bg-black/50 border border-cyan-500/30 flex items-center gap-4 text-xs font-mono shrink-0">
            <div className="p-3 rounded-xl bg-cyan-500/20 text-cyan-300">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase font-bold">Detected Factory Hardware</div>
              <div className="font-extrabold text-white">{hardware.totalRamGb} GB RAM • {hardware.cpuCores} Cores</div>
              <div className="text-[11px] text-cyan-300 truncate max-w-[220px]">{hardware.gpuName}</div>
              <div className="mt-1 text-[10px]">
                {hardware.ollamaStatus === "RUNNING" ? (
                  <span className="text-emerald-400 font-bold">● Local Ollama Active</span>
                ) : (
                  <span className="text-amber-400/80">○ Ollama Offline (Cloud & Built-in Ready)</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Model Selection Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-xs font-mono font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Select AI Brain for Your Enterprise:</span>
          </h2>

          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 font-mono">Active Brain:</span>
            <span className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold">
              ● {activeConfig?.model || activeConfig?.provider || "Built-in Knowledge Core"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((m) => {
            const isSelected = selectedModelId === m.id;
            const isActive = isModelActive(m);
            const isOllama = m.id.startsWith("llama") || m.id.startsWith("deepseek");
            const ollamaMissing = isOllama && hardware?.ollamaStatus !== "RUNNING";

            return (
              <div
                key={m.id}
                onClick={() => {
                  setSelectedModelId(m.id);
                  soundFx.playClick();
                  if (m.id === "built-in-heuristic") {
                    handleActivateModel(m.id);
                  }
                }}
                className={`p-5 rounded-3xl border transition-all flex flex-col justify-between gap-4 relative cursor-pointer ${
                  isActive
                    ? "bg-emerald-950/20 border-emerald-500/60 ring-2 ring-emerald-500/30 shadow-xl shadow-emerald-500/10"
                    : isSelected
                      ? "bg-cyan-500/15 border-cyan-400 ring-2 ring-cyan-400/40 shadow-xl shadow-cyan-500/10"
                      : "bg-white/[0.02] hover:bg-white/[0.05] border-white/10"
                }`}
              >
                {/* Header Badge */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-white/10 text-white/80">
                      {m.size}
                    </span>
                    {isActive ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-emerald-500 text-black shadow animate-pulse">
                        ● CURRENTLY ACTIVE
                      </span>
                    ) : m.isRecommended ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-cyan-400 text-black shadow">
                        ★ RECOMMENDED
                      </span>
                    ) : null}
                  </div>

                  <h3 className="font-black text-sm text-white">{m.name}</h3>
                  <p className="text-[10px] text-cyan-300 font-mono mt-0.5">{m.category}</p>
                  <p className="text-[11px] text-white/60 leading-relaxed mt-2">{m.desc}</p>
                </div>

                {/* Inline notice if Ollama not running */}
                {ollamaMissing && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-200/90 font-mono">
                    <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-400" />
                    Ollama is not running locally. Launch Ollama or use Built-in Core / Gemini.
                  </div>
                )}

                {/* Requirements & Action Button */}
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-white/50">
                    <span>Req: {m.minRamGb}GB RAM</span>
                    <span className="text-cyan-300">{m.category.split(" ")[0]}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleActivateModel(m.id);
                    }}
                    disabled={installing}
                    className={`w-full py-2 px-3 rounded-xl font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isActive
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                        : "bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold shadow-md shadow-cyan-500/20 hover:scale-[1.01] active:scale-[0.99]"
                    }`}
                  >
                    {isActive ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Active Brain ✓</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>⚡ Activate This Brain</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cloud API Key Forms if Cloud Selected */}
      {selectedModelId === "gemini-cloud" && (
        <div className="p-6 rounded-3xl bg-blue-950/30 border border-cyan-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-bold text-cyan-300 block">
              Google Gemini Free API Key:
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono transition-colors"
            >
              <span>Get Free Key at Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="Paste AIzaSy... API key here"
              className="flex-1 h-11 rounded-2xl bg-black/60 border border-white/20 px-4 text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            <button
              onClick={() => handleActivateModel("gemini-cloud")}
              disabled={installing || !geminiApiKey.trim()}
              className="px-6 h-11 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs font-mono disabled:opacity-50 cursor-pointer shrink-0 transition-all flex items-center justify-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Save & Activate Gemini</span>
            </button>
          </div>
          <p className="text-[10px] text-white/40 font-mono">
            100% Free Tier: 15 requests per minute with zero credit card required.
          </p>
        </div>
      )}

      {selectedModelId === "groq-cloud" && (
        <div className="p-6 rounded-3xl bg-purple-950/30 border border-purple-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-bold text-purple-300 block">
              Groq Cloud API Key (Llama 3.3 70B):
            </label>
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-mono transition-colors"
            >
              <span>Get Free Key at console.groq.com</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={groqApiKey}
              onChange={(e) => setGroqApiKey(e.target.value)}
              placeholder="Paste gsk_... API key here"
              className="flex-1 h-11 rounded-2xl bg-black/60 border border-white/20 px-4 text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <button
              onClick={() => handleActivateModel("groq-cloud")}
              disabled={installing || !groqApiKey.trim()}
              className="px-6 h-11 rounded-2xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs font-mono disabled:opacity-50 cursor-pointer shrink-0 transition-all flex items-center justify-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Save & Activate Groq</span>
            </button>
          </div>
          <p className="text-[10px] text-white/40 font-mono">
            Ultra-fast 500 tokens/second inference. Free tier included.
          </p>
        </div>
      )}

      {/* Live Install Progress Bar */}
      {installing && (
        <div className="p-5 rounded-2xl bg-black/60 border border-cyan-500/40 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
            <span>{installStatus}</span>
            <span>{installProgress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500 rounded-full"
              style={{ width: `${installProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Test Live Inference Box */}
      <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold text-white uppercase flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Test Live AURA Cognitive Engine</span>
          </h3>

          <button
            onClick={runTestQuery}
            disabled={testing}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-300 text-xs font-mono font-bold border border-cyan-500/30 flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 transition-all"
          >
            <span>{testing ? "Testing Brain..." : "Send Test Query"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {testResponse ? (
          <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/30 text-xs text-white font-mono leading-relaxed whitespace-pre-wrap">
            {testResponse}
          </div>
        ) : (
          <p className="text-xs text-white/40 font-mono">
            Click &quot;Send Test Query&quot; above to verify live reasoning against your active factory machines, stock, and AS9100 quality rules.
          </p>
        )}
      </div>
    </div>
  );
}
