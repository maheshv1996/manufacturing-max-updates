"use client";

import { useState, useEffect } from "react";
import { Palette, Sparkles } from "lucide-react";

export type ThemePreset = "precision" | "cyberpunk" | "aerospace" | "high-contrast" | "light";

interface ThemeOption {
  id: ThemePreset;
  label: string;
  desc: string;
  dotColor: string;
  badge: string;
}

const THEMES: ThemeOption[] = [
  {
    id: "precision",
    label: "Precision Titanium",
    desc: "Refined dark glassmorphic slate with electric blue accents",
    dotColor: "#3b82f6",
    badge: "Default",
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk Shopfloor",
    desc: "High-visibility telemetry cyan & amber for dim factory floors",
    dotColor: "#00f0ff",
    badge: "Telemetry",
  },
  {
    id: "aerospace",
    label: "Aerospace Navy",
    desc: "AS9100 mission-critical deep navy with sky blue highlights",
    dotColor: "#38bdf8",
    badge: "AS9100",
  },
  {
    id: "high-contrast",
    label: "Sunlight Kiosk (AAA)",
    desc: "Maximum contrast emerald & solid borders for tablet glare",
    dotColor: "#10b981",
    badge: "WCAG AAA",
  },
  {
    id: "light",
    label: "Executive Clean Light",
    desc: "Crisp white & slate for executive presentations & office desks",
    dotColor: "#2563eb",
    badge: "Light",
  },
];

export default function ThemeSwitcher() {
  const [activeTheme, setActiveTheme] = useState<ThemePreset>("precision");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("mfg_theme") as ThemePreset | null;
      if (stored && THEMES.some((t) => t.id === stored)) {
        setActiveTheme(stored);
        document.documentElement.setAttribute("data-theme", stored);
        if (stored === "light") {
          document.documentElement.classList.add("light");
          document.documentElement.classList.remove("dark");
        } else {
          document.documentElement.classList.add("dark");
          document.documentElement.classList.remove("light");
        }
      }
    } catch {}
  }, []);

  const handleSelectTheme = (themeId: ThemePreset) => {
    setActiveTheme(themeId);
    setIsOpen(false);
    try {
      localStorage.setItem("mfg_theme", themeId);
      document.documentElement.setAttribute("data-theme", themeId);
      if (themeId === "light") {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
      } else {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      }
    } catch {}
  };

  const activeOption = THEMES.find((t) => t.id === activeTheme) || THEMES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-700/80 bg-slate-800/60 hover:bg-slate-700/60 text-xs font-bold transition-all cursor-pointer text-slate-200"
        title="Switch Industrial UI Theme"
      >
        <span
          className="w-2.5 h-2.5 rounded-full ring-2 ring-white/20"
          style={{ backgroundColor: activeOption.dotColor }}
        />
        <span className="hidden sm:inline">{activeOption.label.split(" ")[0]}</span>
        <Palette className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-72 p-2 rounded-2xl glass-card border border-slate-700 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-2 border-b border-slate-700/60 mb-1 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Industrial Themes
              </span>
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="space-y-1">
              {THEMES.map((theme) => {
                const isSelected = theme.id === activeTheme;
                return (
                  <button
                    key={theme.id}
                    onClick={() => handleSelectTheme(theme.id)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? "bg-blue-600/20 border border-blue-500/40 text-white"
                        : "hover:bg-slate-800/70 border border-transparent text-slate-300"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full mt-1 shrink-0 ring-2 ring-white/20"
                      style={{ backgroundColor: theme.dotColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold truncate">
                          {theme.label}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                          {theme.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {theme.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
