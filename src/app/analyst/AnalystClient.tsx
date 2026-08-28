"use client";

import { useState } from "react";
import {
  Send,
  Sparkles,
  User,
  Bot,
  ExternalLink,
  RefreshCcw,
} from "lucide-react";
import Link from "next/link";

type Message = {
  id: string;
  role: "user" | "analyst";
  content: string;
  responsePayload?: {
    title: string;
    lines: string[];
    table?: {
      headers: string[];
      rows: (string | number)[][];
    };
    link?: string;
    linkText?: string;
  };
};

export default function AnalystClient() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "analyst",
      content:
        "Hello! I am your AI Analyst. I can answer questions about plant performance, profit margins, machine costs, top downtimes, attendance, stock levels, capacity, and more. Ask me anything!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const SUGGESTIONS = [
    "What was the plant OEE today?",
    "Which jobs lost money this month?",
    "Top downtime reasons last week",
    "Who is the best operator this month?",
    "Show me late attendance this week",
    "What is low on stock?",
    "Are any machines overloaded?",
    "Who owes me money?",
    "What were our energy costs yesterday?",
    "Show me open maintenance jobs",
    "What is our scrap percentage this month?",
  ];

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();

      if (data.answer) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-res",
            role: "analyst",
            content: "Here is what I found:",
            responsePayload: data.answer,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-err",
            role: "analyst",
            content: "Sorry, I couldn't process that question right now.",
          },
        ]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "-err",
          role: "analyst",
          content: "Sorry, an error occurred while fetching the answer.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-slate-800/80 border-b border-slate-700 backdrop-blur-sm p-4 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/60 text-blue-400 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">
              AI Analyst
            </h1>
            <p className="text-xs font-medium text-slate-500">
              Ask questions in plain language
            </p>
          </div>
        </div>
        <button
          onClick={() => setMessages([messages[0]])}
          className="p-2 text-slate-400 hover:text-slate-600 hover:text-slate-300 transition-colors bg-slate-800/60 rounded-lg shadow-sm"
          title="Clear Chat"
        >
          <RefreshCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-4 ${m.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
                m.role === "user"
                  ? "bg-slate-500/15 text-slate-100"
                  : "bg-blue-600 text-white"
              }`}
            >
              {m.role === "user" ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>

            <div
              className={`max-w-[85%] sm:max-w-[75%] space-y-2 ${m.role === "user" ? "items-end text-right" : "items-start text-left"}`}
            >
              {m.content && (
                <div
                  className={`inline-block px-4 py-2.5 rounded-2xl shadow-sm text-sm ${
                    m.role === "user"
                      ? "bg-slate-500/15 text-slate-100 rounded-tr-sm"
                      : "bg-slate-800/60 border border-slate-700 text-slate-300 rounded-tl-sm"
                  }`}
                >
                  {m.content}
                </div>
              )}

              {m.responsePayload && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                  <h3 className="font-bold text-white text-base">
                    {m.responsePayload.title}
                  </h3>

                  {m.responsePayload.lines &&
                    m.responsePayload.lines.length > 0 && (
                      <ul className="space-y-1">
                        {m.responsePayload.lines.map((line, idx) => {
                          // Very simple markdown bold parser for rendering
                          const parts = line.split(/(\*\*.*?\*\*)/g);
                          return (
                            <li key={idx} className="text-sm text-slate-400">
                              {parts.map((p, i) => {
                                if (p.startsWith("**") && p.endsWith("**")) {
                                  return (
                                    <strong
                                      key={i}
                                      className="text-white font-bold"
                                    >
                                      {p.slice(2, -2)}
                                    </strong>
                                  );
                                }
                                return <span key={i}>{p}</span>;
                              })}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                  {m.responsePayload.table && (
                    <div className="overflow-x-auto rounded-xl border border-slate-700 mt-3">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-900/50 text-slate-400">
                          <tr>
                            {m.responsePayload.table.headers.map((h, i) => (
                              <th
                                key={i}
                                className="px-3 py-2 font-semibold border-b border-slate-700 whitespace-nowrap"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 divide-slate-800">
                          {m.responsePayload.table.rows.map((row, i) => (
                            <tr
                              key={i}
                              className="hover:bg-slate-50/60 hover:bg-slate-800/90/20 transition-colors"
                            >
                              {row.map((cell, j) => (
                                <td
                                  key={j}
                                  className="px-3 py-2 text-slate-300 font-medium whitespace-nowrap"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {m.responsePayload.link && (
                    <div className="pt-2">
                      <Link
                        href={m.responsePayload.link}
                        className="inline-flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-700 hover:text-blue-300 transition-colors"
                      >
                        {m.responsePayload.linkText || "Open Report"}
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-4">
            <div className="shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-800/60 border border-slate-700 text-slate-500 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-slate-600 rounded-full animate-bounce"></span>
              <span
                className="w-2 h-2 bg-slate-600 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              ></span>
              <span
                className="w-2 h-2 bg-slate-600 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              ></span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-slate-800/60 border-t border-slate-700 p-4 shrink-0 shadow-sm z-10">
        <div className="mb-4 overflow-x-auto hide-scrollbar flex gap-2 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSend(s)}
              className="shrink-0 text-xs font-medium bg-slate-800/60 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-full transition-colors border border-transparent border-slate-600 shadow-sm whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about OEE, profit, top downtime reasons, stock levels..."
            disabled={loading}
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-xl pl-4 pr-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 p-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
