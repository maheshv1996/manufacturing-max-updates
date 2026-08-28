"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  User,
  LogIn,
  LogOut,
  AlertCircle,
  ChevronRight,
  Factory,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Cpu,
  ShieldCheck,
} from "lucide-react";
import { DEPARTMENTS, type Department } from "@/lib/departments";
import IconTile from "./IconTile";
import ScrambleHeadline from "./ScrambleHeadline";
import InvestorDemoModal from "@/app/components/shared/InvestorDemoModal";

const ThreeHero = dynamic(() => import("@/app/components/shared/ThreeHero"), {
  ssr: false,
  loading: () => null,
});

const HEADLINE = "THE DIGITAL NERVOUS SYSTEM OF YOUR FACTORY";

type View =
  | { name: "home" }
  | { name: "dept"; dept: Department }
  | { name: "login"; dept: Department; fn: { name: string; href: string } };

export default function Gateway({ initialUser }: { initialUser: any }) {
  const router = useRouter();
  const [view, setView] = useState<View>({ name: "home" });
  const [user, setUser] = useState<any>(initialUser);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Onboarding department toggle — key absent / empty = all departments shown.
  const [activeDepartments, setActiveDepartments] = useState<string[] | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setUser(d.user);
      })
      .catch(() => {});
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (
          s &&
          Array.isArray(s.activeDepartments) &&
          s.activeDepartments.length
        ) {
          setActiveDepartments(s.activeDepartments.map(String));
        }
      })
      .catch(() => {});
  }, []);

  const visibleDepartments = activeDepartments
    ? DEPARTMENTS.filter((d) => activeDepartments.includes(d.id))
    : DEPARTMENTS;

  const openDept = (d: Department) => {
    setView({ name: "dept", dept: d });
    setErrorMsg(null);
  };

  const openLogin = (dept: Department, fn: { name: string; href: string }) => {
    setView({ name: "login", dept, fn });
    setErrorMsg(null);
    setPassword("");
  };

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
    router.refresh();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg("Enter your username and password.");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          requestedPath: view.name === "login" ? view.fn.href : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      if (view.name === "login") {
        router.push(data.redirectTo || "/command");
      } else {
        router.push(data.redirectTo || "/command");
      }
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
      setSubmitting(false);
    }
  };

  const breadcrumb = (() => {
    if (view.name === "dept") return [view.dept.title];
    if (view.name === "login") return [view.dept.title, view.fn.name];
    return [];
  })();

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#030408] text-white">
      {/* Cinematic backdrop with mesh gradients */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#060812] via-[#030408] to-[#0d0f1a]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(59,130,246,0.08)_0%,transparent_50%),radial-gradient(ellipse_at_80%_90%,rgba(168,85,247,0.06)_0%,transparent_50%),radial-gradient(ellipse_at_50%_50%,rgba(6,182,212,0.04)_0%,transparent_40%)]" />
        <ThreeHero dimmed />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.015]" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 shadow-lg shadow-blue-500/30">
              <Factory className="w-5 h-5 text-white" />
            </span>
            <div>
              <div className="text-lg font-black tracking-tight leading-none">
                ManufacturingMax - Enterprise Edition
              </div>
              <div className="text-[11px] text-white/50">
                Enterprise MES & Lean Six Sigma
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push("/command")}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur border border-white/15 text-sm font-semibold transition-all hover:border-white/25 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Continue as {user.name || user.username}
                </button>
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-transparent border border-white/10 text-white/50 hover:text-white/90 hover:border-white/25 backdrop-blur text-xs font-medium transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-10">
          <AnimatePresence mode="wait">
            {view.name === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-6xl text-center"
              >
                <ScrambleHeadline
                  text={HEADLINE}
                  enabled={view.name === "home"}
                />
                {/* Investor Demo CTA & Live Factory Ticker */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.15 }}
                  className="mb-8 flex flex-col sm:flex-row items-center justify-center gap-3"
                >
                  <button
                    onClick={() =>
                      window.dispatchEvent(new Event("open-investor-modal"))
                    }
                    className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-cyan-400/30"
                  >
                    <Sparkles className="w-4 h-4 text-cyan-200" />
                    <span>Launch Investor Presentation & ROI Simulator</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] uppercase font-mono">
                      Live
                    </span>
                  </button>

                  <div className="hidden lg:flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-[11px] font-mono text-white/80">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <TrendingUp className="w-3.5 h-3.5" /> 87.4% OEE
                    </span>
                    <span className="text-white/20">|</span>
                    <span className="flex items-center gap-1 text-cyan-300">
                      <Cpu className="w-3.5 h-3.5" /> Weibull RUL Active
                    </span>
                    <span className="text-white/20">|</span>
                    <span className="flex items-center gap-1 text-purple-300">
                      <ShieldCheck className="w-3.5 h-3.5" /> AS9102 Compliant
                    </span>
                  </div>
                </motion.div>

                <motion.div
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, staggerChildren: 0.06 }}
                >
                  {visibleDepartments.map((d, i) => (
                    <motion.div key={d.id}>
                      <IconTile
                        icon={d.icon}
                        label={d.short}
                        sub={d.desc.split("—")[0].trim()}
                        gradient={d.gradient}
                        glow={d.glow}
                        index={i}
                        onClick={() => openDept(d)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}

            {view.name === "dept" && (
              <motion.div
                key={`dept-${view.dept.id}`}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-6xl"
              >
                <motion.button
                  onClick={() => setView({ name: "home" })}
                  whileHover={{ x: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm font-medium mb-6 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> All departments
                </motion.button>

                <div className="flex items-center gap-4 mb-6">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className={`w-14 h-14 flex items-center justify-center text-white bg-gradient-to-br ${view.dept.gradient} rounded-2xl shadow-lg`}
                    style={{ boxShadow: `0 8px 24px -6px ${view.dept.glow}` }}
                  >
                    <view.dept.icon className="w-7 h-7" strokeWidth={1.8} />
                  </motion.div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                      {view.dept.title}
                    </h2>
                    <p className="text-white/50 text-sm">{view.dept.desc}</p>
                  </div>
                </div>

                <motion.div
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ staggerChildren: 0.05 }}
                >
                  {view.dept.functions.map((fn, i) => (
                    <motion.div key={fn.name}>
                      <IconTile
                        icon={fn.icon}
                        label={fn.name}
                        sub={fn.desc}
                        gradient={view.dept.gradient}
                        glow={view.dept.glow}
                        size="md"
                        index={i}
                        onClick={() => openLogin(view.dept, fn)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}

            {view.name === "login" && (
              <motion.div
                key={`login-${view.dept.id}`}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-5xl"
              >
                <motion.button
                  onClick={() => setView({ name: "dept", dept: view.dept })}
                  whileHover={{ x: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm font-medium mb-6 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to {view.dept.short}
                </motion.button>

                <div className="grid md:grid-cols-2 gap-8 items-stretch">
                  {/* Left — cinema + path chip */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="hidden md:flex flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8"
                  >
                    <div className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-4">
                      You are entering
                    </div>
                    <div className="flex items-center gap-2 text-white/80 text-sm mb-6 flex-wrap">
                      {breadcrumb.map((b, i) => (
                        <span key={b} className="flex items-center gap-2">
                          {i > 0 && (
                            <ChevronRight className="w-4 h-4 text-white/30" />
                          )}
                          <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 font-medium">
                            {b}
                          </span>
                        </span>
                      ))}
                    </div>
                    <div
                      className={`w-20 h-20 flex items-center justify-center text-white bg-gradient-to-br ${view.dept.gradient} rounded-[24px] shadow-2xl mb-6`}
                      style={{
                        boxShadow: `0 12px 40px -8px ${view.dept.glow}`,
                      }}
                    >
                      <view.dept.icon className="w-10 h-10" strokeWidth={1.6} />
                    </div>
                    <h3 className="text-2xl font-black tracking-tight leading-snug">
                      Secure access to
                      <br />
                      {view.fn.name}
                    </h3>
                    <p className="text-white/50 text-sm mt-3 leading-relaxed">
                      Your role decides which departments open for you. If you
                      don't have access here, we'll route you to your home hub
                      instead.
                    </p>
                  </motion.div>

                  {/* Right — premium glass login card */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="relative bg-gradient-to-br from-white/8 via-slate-900/60 to-slate-950/80 backdrop-blur-2xl border border-white/15 rounded-3xl p-8 shadow-[0_12px_48px_rgba(0,0,0,0.6)]"
                  >
                    <div className="absolute inset-0 rounded-3xl border border-white/5 -inset-0.5 pointer-events-none" />
                    <div className="relative z-10">
                      <div className="text-center mb-6">
                        <div className="text-2xl font-black tracking-tight">
                          Sign in
                        </div>
                        <p className="text-white/50 text-sm mt-1">
                          to {view.fn.name}
                        </p>
                      </div>

                      {errorMsg && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-sm font-semibold flex items-center gap-3 mb-5"
                        >
                          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                          <span>{errorMsg}</span>
                        </motion.div>
                      )}

                      <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">
                            Employee No.
                          </label>
                          <div className="relative">
                            <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                            <input
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              placeholder="e.g. 1042"
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
                          <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-1.5">
                            Password
                          </label>
                          <div className="relative">
                            <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                            <input
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
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
                          className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/30 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                        >
                          {submitting ? (
                            <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          ) : (
                            <LogIn className="w-4 h-4" />
                          )}
                          {submitting ? "Signing in…" : "Enter department"}
                        </motion.button>
                      </form>

                      <div className="mt-5 text-center">
                        <a
                          href="/login"
                          className="text-xs text-white/40 hover:text-white/70 transition-colors inline-flex items-center gap-1"
                        >
                          Classic staff sign-in{" "}
                          <ArrowRight className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="text-center text-[11px] text-white/25 pb-6">
          ManufacturingMax - Enterprise Edition · Protected Enterprise System · Authorized Access
          Only
        </footer>
      </div>

      <InvestorDemoModal />
    </div>
  );
}
