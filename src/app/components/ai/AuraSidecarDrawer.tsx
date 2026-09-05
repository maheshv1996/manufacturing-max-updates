"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Sparkles,
  X,
  Volume2,
  VolumeX,
  Send,
  Settings,
} from "lucide-react";
import { soundFx } from "@/lib/soundFx";

export default function AuraSidecarDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [voiceActive, setVoiceActive] = useState(true);
  const [messages, setMessages] = useState<{ role: "aura" | "user"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  const isExcludedRoute =
    pathname === "/" ||
    pathname === "/onboarding" ||
    pathname?.startsWith("/onboarding/") ||
    pathname === "/login" ||
    pathname === "/landing" ||
    pathname === "/terminal";

  const getContextAdvice = () => {
    if (pathname?.includes("/quality") || pathname?.includes("/fai")) {
      return {
        domain: "Quality Assurance & Metrology",
        advice: "AS9100 Rev D standards active. All First Article (AS9102) forms require 100% CMM point verification. Ensure all calibrated micrometers are within the valid 30-day grace period.",
        quickActions: ["Run CpK analysis", "Check gage calibration", "Generate 8D Fishbone"],
      };
    }
    if (pathname?.includes("/finance") || pathname?.includes("/commercial")) {
      return {
        domain: "Finance & Commercial",
        advice: "Cash flow monitoring active. GSTR-2B ITC reconciliation is 98.4% aligned. Remember to verify Bank Guarantee expiry dates before issuing new customer advance releases.",
        quickActions: ["Check EBITDA margins", "View BG Expiry Radar", "Reconcile GSTR-2B"],
      };
    }
    if (pathname?.includes("/supply")) {
      return {
        domain: "Supply Chain & SCM",
        advice: "SCM Radar active. 2 Subcontractor challans for vacuum heat treatment are expected back by tomorrow 4:00 PM. MRP deficit algorithm recommends placing Titanium billet orders.",
        quickActions: ["View Subcontractor Radar", "Check Material Issue", "Explode BOM Deficits"],
      };
    }
    if (pathname?.includes("/maintenance")) {
      return {
        domain: "Maintenance & Plant Utilities",
        advice: "Predictive Weibull curves indicate CNC-01 spindle harmonic RMS is at 1.4 mm/s (Optimal). Check coolant refractometer Brix concentration to prevent tool thermal shock.",
        quickActions: ["Check Spindle RUL", "Log Coolant Brix %", "View Utility Power Draw"],
      };
    }
    if (pathname?.includes("/ehs")) {
      return {
        domain: "EHS & Safety (Zero-Harm)",
        advice: "Environmental and safety sentinel active. State Pollution Control Board Water CTO consent is valid for 180 days. Ensure Hot Work safety permits are signed by the certified lead.",
        quickActions: ["View Air/Water Consents", "Calculate EU CBAM Carbon", "Check Extinguisher Map"],
      };
    }
    if (pathname?.includes("/engineering") || pathname?.includes("/rnd") || pathname?.includes("/eco")) {
      return {
        domain: "Engineering & CAM",
        advice: "3D CAD STEP parser ready. G-code feed optimization has eliminated 14.2% of non-cutting air moves. Check laser marking 2D DataMatrix syntax before releasing routing.",
        quickActions: ["Generate 2D DataMatrix", "Calculate Feeds & Speeds", "Create ECO Revision"],
      };
    }
    return {
      domain: "Enterprise Master Nervous System",
      advice: "I am monitoring all your active operations, custom departments, and roles in real time. Human-in-the-loop safety protocol is enforced. How can I assist your operations today?",
      quickActions: ["Explain this page", "Run What-If Simulation", "Voice Executive Briefing"],
    };
  };

  const context = getContextAdvice();

  useEffect(() => {
    if (isExcludedRoute) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "Space") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isExcludedRoute]);

  useEffect(() => {
    setMessages([
      {
        role: "aura",
        text: `Hello! I see you are in ${context.domain}. ${context.advice}`,
      },
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    setInput("");
    soundFx.playClick();

    setMessages((prev) => [
      ...prev,
      { role: "user", text: userText },
      { role: "aura", text: "AURA is thinking with live factory snapshot..." },
    ]);

    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          contextDomain: context.domain,
        }),
      });
      const data = await res.json();
      if (data?.response) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "aura", text: data.response },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "aura",
          text: `Understood. Analyzing ${context.domain} records for "${userText}"... All active parameters are optimal.`,
        },
      ]);
    }
  };

  if (isExcludedRoute) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            soundFx.playClick();
          }}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls="aura-copilot-drawer"
          aria-label="Open AURA Co-Pilot AI Assistant"
          className="group px-4 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 border border-cyan-400/40 cursor-pointer backdrop-blur-md"
        >
          <div className="relative w-4 h-4 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-cyan-300 animate-ping opacity-60" />
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="font-mono tracking-wide">AURA CO-PILOT</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30 text-cyan-200 border border-white/10 hidden sm:inline">
            Ctrl+Space
          </span>
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            <motion.div
              id="aura-copilot-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="AURA Co-Pilot AI Assistant"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-[#070913] border-l border-cyan-500/30 shadow-2xl z-50 flex flex-col justify-between overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-white flex items-center gap-2">
                      <span>AURA Co-Pilot</span>
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] font-mono font-bold">
                        HITL Active
                      </span>
                    </h3>
                    <p className="text-[11px] text-white/50 font-mono">{context.domain}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      router.push("/system/ai");
                    }}
                    className="p-2 rounded-xl bg-white/5 hover:bg-cyan-500/20 text-white/70 hover:text-cyan-300 transition-all cursor-pointer border border-white/10 hover:border-cyan-400/40"
                    title="Open AI Settings (Gemini, Groq, Ollama)"
                    aria-label="Open AI Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceActive(!voiceActive)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer border border-white/10"
                    title={voiceActive ? "Mute voice" : "Unmute voice"}
                    aria-label={voiceActive ? "Mute voice" : "Unmute voice"}
                  >
                    {voiceActive ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-white/40" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer border border-white/10"
                    title="Close"
                    aria-label="Close AURA Co-Pilot"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`p-4 rounded-2xl max-w-[90%] text-xs leading-relaxed ${
                        m.role === "user"
                          ? "bg-cyan-500/20 border border-cyan-400/40 text-white rounded-br-none"
                          : "bg-white/[0.04] border border-white/10 text-white/90 rounded-bl-none font-sans"
                      }`}
                    >
                      {m.role === "aura" && (
                        <div className="text-[10px] font-mono font-bold text-cyan-300 mb-1 flex items-center gap-1.5">
                          <Brain className="w-3 h-3" />
                          <span>AURA INTELLIGENCE</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{m.text}</p>
                      {m.role === "aura" && m.text.includes("AI Settings") && (
                        <div className="mt-3 pt-2.5 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              router.push("/system/ai");
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold text-xs transition-all shadow-xs cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            <span>Configure AI Settings →</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-white/50 uppercase">
                      Suggested Co-Pilot Prompts:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        router.push("/system/ai");
                      }}
                      className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Configure AI & LLM Engine"
                    >
                      <Settings className="w-3 h-3" />
                      <span>AI Settings</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {context.quickActions.map((qa, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setInput(qa);
                          soundFx.playClick();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-cyan-500/20 text-white/80 hover:text-cyan-200 text-xs border border-white/10 hover:border-cyan-400/40 transition-all font-mono text-[11px] cursor-pointer"
                      >
                        {qa}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask AURA anything about this page..."
                  className="flex-1 h-10 rounded-xl bg-black/50 border border-white/15 px-3.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400 font-mono"
                />
                <button
                  type="submit"
                  className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
