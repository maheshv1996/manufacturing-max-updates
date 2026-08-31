"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Activity,
  Cpu,
  CheckCircle2,
  DownloadCloud,
  Layers,
  ArrowRight,
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
  const [selectedModelId, setSelectedModelId] = useState<string>("llama3.2:3b");
  const [geminiApiKey, setGeminiApiKey] = useState("");
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
        setModels(data.availableModels);
        if (data.recommendedModelId) {
          setSelectedModelId(data.recommendedModelId);
        }
      }

      const confRes = await fetch("/api/system/ai");
      const confData = await confRes.json();
      if (confData?.success && confData.config) {
        setActiveConfig(confData.config);
        if (confData.config.provider === "gemini") {
          setSelectedModelId("gemini-cloud");
          setGeminiApiKey(confData.config.apiKey || "");
        } else if (confData.config.model) {
          setSelectedModelId(confData.config.model);
        }
      }
    } catch (err) {
      logClientError("Failed to load hardware specs:", err, "AiSettingsClient");
    }
  };

  useEffect(() => {
    fetchHardwareAndModels();
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    setInstallProgress(15);
    setInstallStatus("Detecting local engine runtime environment...");
    soundFx.playClick();

    try {
      setTimeout(() => {
        setInstallProgress(45);
        setInstallStatus("Allocating memory buffers & configuring model weights...");
      }, 700);

      setTimeout(() => {
        setInstallProgress(80);
        setInstallStatus("Establishing neural pipeline handshake with AURA...");
      }, 1500);

      const isCloud = selectedModelId === "gemini-cloud";
      const modelObj = models.find((m) => m.id === selectedModelId);

      const res = await fetch("/api/system/ai/install-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModelId,
          tag: modelObj?.tag || selectedModelId,
          provider: isCloud ? "gemini" : "ollama",
          apiKey: geminiApiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Installation failed");

      setInstallProgress(100);
      setInstallStatus("AURA Neural Brain is Online and Ready!");
      soundFx.playSuccess();
      toast.success(`Activated ${modelObj?.name || selectedModelId} successfully!`);
      fetchHardwareAndModels();
    } catch (err: any) {
      toast.error(err.message);
      setInstallStatus("Error configuring brain: " + err.message);
    } finally {
      setTimeout(() => setInstalling(false), 2000);
    }
  };

  const handleTestInference = async () => {
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
      if (!res.ok || !data.success) throw new Error(data.error || "Inference failed");
      setTestResponse(`[${data.provider} // ${data.model}]\n\n${data.response}`);
      soundFx.playSuccess();
      toast.success("Live LLM test successful!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Hardware Diagnosis */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-950/40 via-cyan-950/30 to-purple-950/40 border border-cyan-500/20 backdrop-blur-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold border border-cyan-500/30">
              1-CLICK AI BRAIN INSTALLER
            </span>
            <span className="text-xs text-white/50 font-mono">AUTOMATED HARDWARE DETECTION</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            AI Neural Model & Hardware Architecture
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            The software analyzes your computer's RAM, CPU cores, and GPU to automatically select and configure the best AI model with 1 click. Zero command lines required.
          </p>
        </div>

        {/* Live Hardware Specs Card */}
        {hardware && (
          <div className="p-4 rounded-2xl bg-black/50 border border-cyan-500/30 flex items-center gap-4 text-xs font-mono">
            <div className="p-3 rounded-xl bg-cyan-500/20 text-cyan-300">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase font-bold">Detected Factory Hardware</div>
              <div className="font-extrabold text-white">{hardware.totalRamGb} GB RAM • {hardware.cpuCores} Cores</div>
              <div className="text-[11px] text-cyan-300 truncate max-w-[220px]">{hardware.gpuName}</div>
            </div>
          </div>
        )}
      </div>

      {/* Model Selection Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Select AI Brain for Your Factory Computer:</span>
          </h2>

          <span className="text-xs text-white/40 font-mono">
            Active Brain: <strong className="text-cyan-300 uppercase">{activeConfig?.model || "Llama 3.2 (3B)"}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {models.map((m) => {
            const isSelected = selectedModelId === m.id;
            return (
              <div
                key={m.id}
                onClick={() => {
                  setSelectedModelId(m.id);
                  soundFx.playClick();
                }}
                className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between gap-4 relative ${
                  isSelected
                    ? "bg-cyan-500/15 border-cyan-400 ring-2 ring-cyan-400/40 shadow-xl shadow-cyan-500/10"
                    : "bg-white/[0.02] hover:bg-white/[0.05] border-white/10"
                }`}
              >
                {/* Header Badge */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-white/10 text-white/80">
                      {m.size}
                    </span>
                    {m.isRecommended && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-cyan-400 text-black shadow">
                        ★ RECOMMENDED
                      </span>
                    )}
                  </div>

                  <h3 className="font-black text-sm text-white">{m.name}</h3>
                  <p className="text-[10px] text-cyan-300 font-mono mt-0.5">{m.category}</p>
                  <p className="text-[11px] text-white/50 leading-relaxed mt-2">{m.desc}</p>
                </div>

                {/* Requirements & Selection Dot */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-white/50">
                  <span>Req: {m.minRamGb}GB RAM</span>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${isSelected ? "bg-cyan-400 text-black" : "border border-white/20"}`}>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cloud Key Form if Cloud Selected */}
      {selectedModelId === "gemini-cloud" && (
        <div className="p-5 rounded-2xl bg-blue-950/30 border border-cyan-500/30 space-y-2">
          <label className="text-xs font-mono font-bold text-cyan-300 block">
            Google Gemini Free API Key:
          </label>
          <input
            type="password"
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full h-9 rounded-xl bg-black/50 border border-white/20 px-3 text-xs text-white font-mono"
          />
          <p className="text-[10px] text-white/40 font-mono">
            Get your free key at: aistudio.google.com (100% Free Tier: 15 requests per minute)
          </p>
        </div>
      )}

      {/* 1-Click Install Button & Progress */}
      <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-extrabold text-sm text-white">Ready to Initialize AI Brain?</h4>
          <p className="text-xs text-white/50 font-mono mt-0.5">
            Clicking below will automatically setup and connect the selected model to AURA.
          </p>
        </div>

        <button
          onClick={handleInstall}
          disabled={installing}
          className="px-8 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow-xl shadow-cyan-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <DownloadCloud className="w-4 h-4" />
          <span>{installing ? "Configuring AI Engine..." : "⚡ 1-Click Activate AI Brain"}</span>
        </button>
      </div>

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
            <span>Test Live AURA Cognitive Response</span>
          </h3>

          <button
            onClick={handleTestInference}
            disabled={testing}
            className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-300 text-xs font-mono font-bold border border-cyan-500/30 flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
          >
            <span>{testing ? "Testing..." : "Send Test Query"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {testResponse && (
          <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/30 text-xs text-white font-mono leading-relaxed whitespace-pre-wrap">
            {testResponse}
          </div>
        )}
      </div>
    </div>
  );
}
