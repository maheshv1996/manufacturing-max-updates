"use client";

import { logClientError } from "@/lib/clientLogger";
/* eslint-disable @next/next/no-img-element -- branding logoUrl is dynamic external URL, not statically importable */

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Factory, Lock, User, LogIn, AlertCircle } from "lucide-react";
import LanguageToggle from "@/app/components/layout/LanguageToggle";
import { t, Language } from "@/lib/i18n";
import dynamic from "next/dynamic";

const ThreeHero = dynamic(() => import("@/app/components/shared/ThreeHero"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-slate-950 z-0"></div>,
});

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [branding, setBranding] = useState<any>(null);
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.branding) setBranding(data.branding);
        if (data.googleOAuthEnabled !== undefined) {
          setGoogleOAuthEnabled(data.googleOAuthEnabled);
        }
      })
      .catch((err) => logClientError(err, "LoginPage"));

    const errParam = searchParams.get("error");
    if (errParam === "google-not-registered") {
      setErrorMsg(
        "This Google account is not registered. Ask your admin to create your account first.",
      );
    } else if (errParam === "google-not-configured") {
      setErrorMsg(
        "Google Sign In is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars.",
      );
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg("Please enter both username and password.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Login failed. Please check credentials.",
        );
      }

      router.push(data.redirectTo || "/");
      router.refresh();
    } catch (err) {
      logClientError("Login error:", err, "page");
      setErrorMsg(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const [currentLang, setCurrentLang] = useState<Language>("en");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("operator_lang") as Language;
      if (saved && ["en", "te", "hi"].includes(saved)) {
        setCurrentLang(saved);
      }
    }
  }, []);

  const handleLangChange = (lang: Language) => {
    setCurrentLang(lang);
  };

  return (
    <div className="min-h-screen bg-[#030408] text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Cinematic backdrop matching Gateway */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#060812] via-[#030408] to-[#0d0f1a]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(59,130,246,0.08)_0%,transparent_50%),radial-gradient(ellipse_at_80%_90%,rgba(168,85,247,0.06)_0%,transparent_50%),radial-gradient(ellipse_at_50%_50%,rgba(6,182,212,0.04)_0%,transparent_40%)]" />
        <ThreeHero dimmed={true} />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.015]" />
      </div>

      <div className="relative z-10 max-w-md w-full">
        {/* Premium glass login card */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 280,
            damping: 24,
            duration: 0.6,
          }}
          className="relative bg-gradient-to-br from-white/8 via-slate-900/60 to-slate-950/80 backdrop-blur-2xl border border-white/15 rounded-3xl p-8 shadow-[0_12px_48px_rgba(0,0,0,0.6)]"
        >
          <div className="absolute inset-0 rounded-3xl border border-white/5 -inset-0.5 pointer-events-none" />

          <div className="relative z-10 space-y-8">
            <div className="flex justify-end">
              <LanguageToggle
                currentLang={currentLang}
                onLanguageChange={handleLangChange}
              />
            </div>

            <div className="text-center space-y-3">
              {branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt="Logo"
                  className="w-16 h-16 mx-auto object-contain bg-white/10 backdrop-blur-sm rounded-xl p-1 border border-white/10"
                />
              ) : (
                <div className="inline-flex p-3 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-2xl shadow-lg shadow-blue-500/30 text-white mb-1">
                  <Factory className="w-10 h-10" />
                </div>
              )}
              <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-blue-300 bg-clip-text text-transparent">
                {branding?.appName || "ManufacturingMax - Enterprise Edition"}
              </h1>
              <p className="text-slate-400 text-sm font-medium">
                {t("loginTitle", currentLang)}
              </p>
            </div>

            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-sm font-semibold flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  {t("usernameLabel", currentLang)}
                </label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. 1042"
                    required
                    autoComplete="username"
                    inputMode={
                      /iPad|Tablet|Android/i.test(navigator.userAgent)
                        ? "numeric"
                        : undefined
                    }
                    className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  {t("passwordLabel", currentLang)}
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/50 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)] transition-all"
                  />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/30 disabled:opacity-60 disabled:cursor-not-allowed transition-all min-h-[56px] cursor-pointer"
              >
                {submitting ? (
                  <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                {submitting
                  ? t("signingIn", currentLang)
                  : t("signInBtn", currentLang)}
              </motion.button>

              <button
                type="button"
                onClick={async () => {
                  setUsername("admin");
                  setPassword("factory123");
                  setSubmitting(true);
                  setErrorMsg(null);
                  try {
                    const res = await fetch("/api/auth/login", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ username: "admin", password: "factory123" }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Login failed");
                    router.push(data.redirectTo || "/onboarding");
                    router.refresh();
                  } catch (err: any) {
                    setErrorMsg(err.message || "Failed to auto-login");
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <span>⚡ 1-Click Master Developer Login (Permanent Session)</span>
              </button>
            </form>

            {googleOAuthEnabled && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-5 border-t border-white/10 space-y-3 text-center"
              >
                <a
                  href="/api/auth/google"
                  className="w-full min-h-[50px] bg-white/5 backdrop-blur-xl hover:bg-white/10 text-white text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-3 border border-white/10 shadow-md"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Sign in with Google
                </a>
                <p className="text-xs text-slate-400 font-medium">
                  For managers with a registered email
                </p>
              </motion.div>
            )}

            <div className="text-center pt-2 border-t border-white/10 text-xs text-white/30 font-medium">
              Protected Enterprise System • Authorized Access Only
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#030408] text-white flex items-center justify-center p-4">
          <div className="text-sm font-mono text-slate-400">
            Loading auth...
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
