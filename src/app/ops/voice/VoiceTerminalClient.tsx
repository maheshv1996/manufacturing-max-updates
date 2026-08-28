"use client";

import { useState } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  Terminal,
  Activity,
  Wrench,
  Plus,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface VoiceLog {
  id: string;
  transcript: string;
  actionExecuted: string;
  spokenResponse: string;
  timestamp: string;
}

export default function VoiceTerminalClient() {
  const [isListening, setIsListening] = useState(false);
  const [activeSpeech, setActiveSpeech] = useState<string | null>(null);
  const [voiceLogs, setVoiceLogs] = useState<VoiceLog[]>([
    {
      id: "log-0",
      transcript: "Clock 5 pieces on CNC-01",
      actionExecuted: "CLOCK_PARTS",
      spokenResponse:
        "Clocked 5 good manufactured pieces for Work Order 1001 on CNC-01. Target batch progress updated to 54 percent.",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [processing, setProcessing] = useState(false);

  const speakText = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleVoiceCommand = async (commandText: string) => {
    setProcessing(true);
    setActiveSpeech(commandText);
    try {
      const res = await fetch("/api/ops/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: commandText }),
      });

      if (res.ok) {
        const data = await res.json();
        const newLog: VoiceLog = {
          id: `log-${Date.now()}`,
          transcript: data.transcript,
          actionExecuted: data.actionExecuted,
          spokenResponse: data.spokenResponse,
          timestamp: data.timestamp || new Date().toLocaleTimeString(),
        };
        setVoiceLogs((prev) => [newLog, ...prev]);
        speakText(data.spokenResponse);
      }
    } catch (err) {
      console.error("Voice error:", err);
    } finally {
      setProcessing(false);
      setIsListening(false);
    }
  };

  const sampleCommands = [
    { label: "Clock 5 pieces on CNC-01", icon: Plus },
    { label: "Call maintenance to Cell 1", icon: Wrench },
    { label: "Check spindle vibration on CNC-02", icon: Activity },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 select-none">
      <PageHeader
        title="Hands-Free Shopfloor Voice Command Terminal"
        description="Acoustic voice synthesis & hands-free speech recognition: 1-spoken piece clocking, Andon radio dispatches, and telemetry lookups."
      >
        <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center gap-1.5 font-mono">
          <Volume2 className="w-4 h-4 text-cyan-400" />
          Acoustic Voice Engine Active
        </span>
      </PageHeader>

      {/* Central Microphone Action Area */}
      <div className="bg-slate-950 border-2 border-border/80 rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden">
        {/* Pulsing Audio Waveform Simulation */}
        <div className="flex items-center gap-1.5 h-16">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 bg-cyan-400 rounded-full transition-all duration-300 ${
                isListening || processing ? "animate-pulse" : "opacity-30"
              }`}
              style={{
                height:
                  isListening || processing
                    ? `${20 + Math.sin(i * 0.8) * 35}px`
                    : "8px",
              }}
            />
          ))}
        </div>

        {/* Push-to-Talk Mic Button */}
        <button
          onClick={() => {
            if (!isListening) {
              setIsListening(true);
              handleVoiceCommand("Clock 5 pieces on CNC-01");
            } else {
              setIsListening(false);
            }
          }}
          disabled={processing}
          className={`w-28 h-28 rounded-full flex flex-col items-center justify-center gap-1 font-bold text-xs shadow-2xl cursor-pointer transition-all border-4 ${
            isListening || processing
              ? "bg-rose-600 hover:bg-rose-500 border-rose-400 ring-8 ring-rose-500/30 scale-105"
              : "bg-cyan-600 hover:bg-cyan-500 border-cyan-400 ring-8 ring-cyan-500/20 hover:scale-105"
          } text-white`}
        >
          {isListening ? (
            <>
              <MicOff className="w-8 h-8 animate-pulse" />
              <span>LISTENING</span>
            </>
          ) : (
            <>
              <Mic className="w-8 h-8" />
              <span>PUSH TO TALK</span>
            </>
          )}
        </button>

        <p className="text-xs text-text-3 font-mono">
          {activeSpeech
            ? `Last Command: "${activeSpeech}"`
            : "Click microphone or select a pre-recorded industrial phrase below:"}
        </p>

        {/* 1-Click Pre-Recorded Industrial Voice Phrases */}
        <div className="flex items-center gap-3 flex-wrap justify-center pt-2">
          {sampleCommands.map((cmd, idx) => (
            <button
              key={idx}
              onClick={() => handleVoiceCommand(cmd.label)}
              disabled={processing}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-surface-2 hover:bg-surface-3 border border-border text-xs font-bold text-text-1 hover:text-cyan-300 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              <cmd.icon className="w-4 h-4 text-cyan-400" />
              <span>&quot;{cmd.label}&quot;</span>
            </button>
          ))}
        </div>
      </div>

      {/* Voice Execution History Log */}
      <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-accent" />
            <h3 className="font-extrabold text-base text-text-1">
              Voice Command Transcript Log
            </h3>
          </div>
          <span className="text-xs font-mono text-text-3">
            {voiceLogs.length} Total Commands
          </span>
        </div>

        <div className="space-y-3">
          {voiceLogs.map((log) => (
            <div
              key={log.id}
              className="p-4 rounded-2xl bg-surface-2 border border-border/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-text-1">
                    &quot;{log.transcript}&quot;
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                    {log.actionExecuted}
                  </span>
                </div>
                <p className="text-xs text-text-3 leading-relaxed">
                  {log.spokenResponse}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => speakText(log.spokenResponse)}
                  className="p-2 rounded-xl bg-surface-1 hover:bg-surface-3 border border-border text-text-2 hover:text-cyan-300 transition-colors cursor-pointer"
                  title="Play audio response"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <span className="text-[10px] text-text-3 font-mono">
                  {log.timestamp}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
