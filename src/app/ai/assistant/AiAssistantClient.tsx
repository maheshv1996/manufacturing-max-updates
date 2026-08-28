"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Send, Bot, User, ArrowRight, RefreshCw } from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  metrics?: { label: string; value: string; color?: string }[];
  actions?: { label: string; href: string }[];
  timestamp: string;
}

export default function AiAssistantClient() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-0",
      sender: "bot",
      text: "Hello! I am your **Shopfloor AI Copilot**, connected directly to live factory telemetry, work orders, 3D digital twins, and the ISA-95 Unified Namespace.\n\nHow can I assist you with operations, diagnostics, or quality today?",
      actions: [
        { label: "View 3D Digital Twin", href: "/digital-twin/cell" },
        { label: "Check Telemetry Historian", href: "/iot/telemetry" },
        { label: "Open MRP Workbench", href: "/supply/mrp" },
      ],
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend }),
      });

      if (res.ok) {
        const data = await res.json();
        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: data.reply,
          metrics: data.metricsSummary,
          actions: data.actionLinks,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => [...prev, botMsg]);
      }
    } catch (err) {
      console.error("AI error:", err);
    } finally {
      setLoading(false);
    }
  };

  const promptChips = [
    "Check machine vibration & temperature anomalies",
    "Analyze open work order bottlenecks & cycle times",
    "Scan raw material stock shortages & MRP requisitions",
    "Show edge gateway throughput & Sparkplug B states",
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <PageHeader
        title="Shopfloor AI Copilot & Factory Intelligence"
        description="Generative AI assistant grounded in live telemetry, work orders, AS9102 quality records, and 3D digital twins."
      >
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Gemini GenAI Active
          </span>
        </div>
      </PageHeader>

      {/* Suggested Prompt Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {promptChips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip)}
            className="px-3.5 py-1.5 rounded-xl bg-surface-1 hover:bg-surface-2 border border-border text-xs font-semibold text-text-2 hover:text-accent transition-all cursor-pointer whitespace-nowrap shadow-sm flex items-center gap-1.5"
          >
            <Sparkles className="w-3 h-3 text-accent" />
            <span>{chip}</span>
          </button>
        ))}
      </div>

      {/* Main Chat Feed Container */}
      <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm min-h-[480px] flex flex-col justify-between space-y-6">
        {/* Messages List */}
        <div className="space-y-5 overflow-y-auto max-h-[500px] pr-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3.5 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.sender === "bot" && (
                <div className="p-2.5 rounded-2xl bg-accent/15 border border-accent/30 text-accent h-fit shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-3xl p-5 space-y-3 shadow-md ${
                  msg.sender === "user"
                    ? "bg-accent text-white font-medium text-sm rounded-tr-sm"
                    : "bg-surface-2 border border-border text-text-1 text-xs rounded-tl-sm"
                }`}
              >
                <div className="whitespace-pre-line leading-relaxed">
                  {msg.text}
                </div>

                {/* Metrics Summary Strip */}
                {msg.metrics && msg.metrics.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 font-mono">
                    {msg.metrics.map((m, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-xl bg-surface-1 border border-border/60 text-center"
                      >
                        <span className="text-[10px] text-text-3 uppercase block">
                          {m.label}
                        </span>
                        <span
                          className={`text-xs font-bold ${m.color || "text-text-1"}`}
                        >
                          {m.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 1-Click Action Buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/40">
                    {msg.actions.map((act, i) => (
                      <Link
                        key={i}
                        href={act.href}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-1 hover:bg-surface-3 border border-border text-[11px] font-bold text-accent transition-colors"
                      >
                        <span>{act.label}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    ))}
                  </div>
                )}

                <div className="text-[10px] opacity-60 text-right font-mono mt-1">
                  {msg.timestamp}
                </div>
              </div>

              {msg.sender === "user" && (
                <div className="p-2.5 rounded-2xl bg-surface-2 border border-border text-text-2 h-fit shrink-0">
                  <User className="w-5 h-5" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3.5 justify-start">
              <div className="p-2.5 rounded-2xl bg-accent/15 border border-accent/30 text-accent h-fit shrink-0 animate-pulse">
                <Bot className="w-5 h-5" />
              </div>
              <div className="bg-surface-2 border border-border rounded-3xl p-4 text-xs text-text-3 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-accent animate-spin" />
                <span>
                  Analyzing factory telemetry, work orders, and digital twins...
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-center gap-2 pt-3 border-t border-border"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask your factory: 'Check CNC-01 spindle temp' or 'Find delivery bottlenecks'..."
            className="flex-1 bg-surface-2 border border-border rounded-2xl px-4 py-3 text-xs text-text-1 placeholder:text-text-3 focus:outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={loading || !inputQuery.trim()}
            className="p-3 rounded-2xl bg-accent hover:bg-accent-hover text-white transition-all cursor-pointer disabled:opacity-50 shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
