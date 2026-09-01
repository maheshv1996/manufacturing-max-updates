"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ArrowRight } from "lucide-react";

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-command-palette", handleOpen);
    return () => window.removeEventListener("open-command-palette", handleOpen);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.results) {
          setResults(data.results);
        }
      } catch (err) {
        logClientError(err, "CommandPalette");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-start justify-center pt-[12vh] p-4">
      <div
        className="bg-surface-1 rounded-3xl shadow-2xl w-full max-w-2xl border border-border overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-5 py-4 border-b border-border">
          <Search className="w-5 h-5 text-accent mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search functions, tools, machines, work orders, schemas... (Ctrl+K)"
            className="flex-1 bg-transparent border-none outline-none text-text-1 placeholder:text-text-3 text-base font-medium"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && (
            <Loader2 className="w-5 h-5 text-accent animate-spin ml-3" />
          )}
          <kbd className="hidden sm:inline-flex ml-3 items-center gap-1 font-mono text-xs bg-surface-3 text-text-3 px-2 py-1 rounded-lg">
            ESC
          </kbd>
        </div>

        {(results.length > 0 || query.length >= 2) && (
          <div className="max-h-[60vh] overflow-y-auto p-3 space-y-1">
            {results.length > 0 ? (
              <div>
                <div className="px-3 py-1.5 text-[10px] font-bold text-text-3 uppercase tracking-wider">
                  Matching Functions & Records
                </div>
                {results.map((result, idx) => (
                  <button
                    key={`${result.type}-${result.id}-${idx}`}
                    onClick={() => {
                      setIsOpen(false);
                      router.push(result.href);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-3 hover:bg-surface-2 rounded-2xl text-left transition-colors cursor-pointer group"
                  >
                    <div>
                      <div className="text-sm font-bold text-text-1 group-hover:text-accent transition-colors">
                        {result.title}
                      </div>
                      {result.description ? (
                        <div className="text-xs text-text-3 mt-0.5">
                          {result.description}
                        </div>
                      ) : (
                        <div className="text-xs text-text-3 mt-0.5 font-mono">
                          {result.href}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                          result.type === "Function"
                            ? "bg-accent/15 text-accent"
                            : result.type === "Machine"
                              ? "bg-cyan-500/15 text-cyan-300"
                              : result.type === "Work Order"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-surface-3 text-text-3"
                        }`}
                      >
                        {result.type}
                      </span>
                      <ArrowRight className="w-4 h-4 text-text-3 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                ))}
              </div>
            ) : !loading && query.length >= 2 ? (
              <div className="px-4 py-8 text-center text-text-3 text-sm">
                No matching functions or records found for &quot;{query}&quot;.
              </div>
            ) : null}
          </div>
        )}

        {query.length === 0 && (
          <div className="p-4 space-y-3">
            <div className="text-[10px] font-bold text-text-3 uppercase tracking-wider">
              Quick Jump & Intelligence
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: "Gateway 3D", href: "/", tag: "Hub" },
                { label: "Master Brain AI", href: "/ai/cortex", tag: "AURA" },
                { label: "Operator Terminal", href: "/terminal", tag: "Shopfloor" },
                { label: "Active Work Orders", href: "/ops/work-orders", tag: "PPC" },
                { label: "Machine Radar", href: "/system/machines", tag: "IoT" },
                { label: "Quality Hub (AS9100)", href: "/quality", tag: "QA" },
              ].map((item) => (
                <button
                  key={item.href}
                  onClick={() => {
                    setIsOpen(false);
                    router.push(item.href);
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-surface-2/60 hover:bg-surface-3 text-left transition-all cursor-pointer group"
                >
                  <span className="text-xs font-bold text-text-1 group-hover:text-accent truncate">
                    {item.label}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface-3 text-text-3">
                    {item.tag}
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-text-3">
              <div className="flex items-center gap-1.5">
                <kbd className="bg-surface-3 px-1.5 py-0.5 rounded text-[10px] font-mono">
                  Ctrl
                </kbd>
                <kbd className="bg-surface-3 px-1.5 py-0.5 rounded text-[10px] font-mono">
                  K
                </kbd>
                <span>Global Omni-Search</span>
              </div>
              <span className="text-[11px] font-mono text-text-3">
                254 Routes &amp; 100+ Functions Indexed
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      <div
        className="absolute inset-0 z-[-1]"
        onClick={() => setIsOpen(false)}
      />
    </div>
  );
}
