"use client";


import { logClientError } from "@/lib/clientLogger";
import { useEffect, useState } from "react";
import { Language } from "@/lib/i18n";
import { offlineFetchWrapper } from "@/lib/offlineSync";

interface LanguageToggleProps {
  currentLang?: Language;
  onLanguageChange?: (lang: Language) => void;
  userId?: string;
  className?: string;
}

export default function LanguageToggle({
  currentLang,
  onLanguageChange,
  userId,
  className = "",
}: LanguageToggleProps) {
  const [lang, setLang] = useState<Language>("en");

  useEffect(() => {
    if (currentLang) {
      setLang(currentLang);
    } else if (typeof window !== "undefined") {
      const saved = localStorage.getItem("operator_lang") as Language;
      if (saved && ["en", "te", "hi"].includes(saved)) {
        setLang(saved);
      }
    }
  }, [currentLang]);

  const selectLanguage = async (newLang: Language) => {
    setLang(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("operator_lang", newLang);
      // Dispatch event so other components on page re-render instantly
      window.dispatchEvent(
        new CustomEvent("operator_lang_changed", { detail: newLang }),
      );
    }

    if (onLanguageChange) {
      onLanguageChange(newLang);
    }

    // Optionally save to user prefs if userId provided
    if (userId) {
      try {
        await offlineFetchWrapper("/api/user/prefs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang: newLang }),
        });
      } catch (err) {
        logClientError("Failed to update user language preference:", err, "LanguageToggle");
      }
    }
  };

  const languages: { code: Language; label: string; native: string }[] = [
    { code: "en", label: "EN", native: "English" },
    { code: "te", label: "తె", native: "తెలుగు" },
    { code: "hi", label: "हि", native: "हिंदी" },
  ];

  return (
    <div
      className={`inline-flex items-center p-1 bg-slate-800/60 rounded-xl border border-slate-600 shadow-inner ${className}`}
    >
      {languages.map((l) => {
        const isActive = lang === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => selectLanguage(l.code)}
            title={l.native}
            className={`px-2.5 py-1 text-xs font-black rounded-lg transition-all ${
              isActive
                ? "bg-slate-800/60 text-blue-400 shadow-sm scale-105"
                : "text-slate-400 hover:text-slate-900 hover:text-white"
            }`}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
