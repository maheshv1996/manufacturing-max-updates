"use client";

import { useState, useEffect } from "react";
import {
  Check,
  ArrowRight,
  ShieldCheck,
  Factory,
  Zap,
  Activity,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useInView } from "framer-motion";
import ScrambleText from "../components/shared/ScrambleText";
import { useRef } from "react";

const ThreeHero = dynamic(() => import("../components/shared/ThreeHero"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-slate-900 z-0"></div>,
});

const Counter = ({
  from = 0,
  to,
  duration = 2,
}: {
  from?: number;
  to: number;
  duration?: number;
}) => {
  const [count, setCount] = useState(from);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      const start = from;
      const end = to;
      let startTime: number | null = null;

      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min(
          (timestamp - startTime) / (duration * 1000),
          1,
        );

        // Easing out cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        setCount(Math.floor(start + (end - start) * easeOut));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [isInView, from, to, duration]);

  return <span ref={ref}>{count}</span>;
};

const FadeIn = ({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default function LandingPage() {
  const [form, setForm] = useState({
    company: "",
    contactName: "",
    phone: "",
    email: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<any>(null);

  useEffect(() => {
    fetch("/api/marketing/landing")
      .then((r) => r.json())
      .then((d) => {
        if (d.landing) setContent(d.landing);
      })
      .catch(() => {});
  }, []);

  const DEFAULT_STATS = [
    { value: 140, suffix: "+", label: "Features" },
    { value: 13, suffix: "", label: "Reports" },
    { value: 9, suffix: "", label: "Departments" },
    { value: 3, suffix: "", label: "Plants" },
  ];
  const stats = content?.stats || DEFAULT_STATS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/landing/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        alert("Failed to submit request.");
      }
    } catch (error) {
      alert("Error submitting request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans selection:bg-blue-500/30 overflow-hidden text-slate-200">
      {/* Hero Section */}
      <div className="relative min-h-[90vh] flex items-center justify-center pt-20 pb-16 overflow-hidden">
        <ThreeHero />

        {/* Gradient Mesh overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950/80 to-slate-950 z-0 pointer-events-none"></div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold text-sm mb-8 border border-blue-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.2)]"
          >
            <Factory className="w-4 h-4" />
            {content?.badge || "Manufacturing Max"}
          </motion.div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-[1.1] text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">
            <ScrambleText
              text={content?.heroLines?.[0] || "THE DIGITAL NERVOUS"}
            />
            <br className="hidden md:block" />
            <ScrambleText
              text={content?.heroLines?.[1] || "SYSTEM OF YOUR FACTORY"}
              delay={0.5}
            />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed font-light"
          >
            {content?.heroSubtitle ||
              "Track OEE in real-time, eliminate downtime, and run your shop floor seamlessly with our all-in-one digital manufacturing platform."}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href="#pricing"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:-translate-y-1 flex items-center gap-2 text-lg"
            >
              {content?.ctaPrimary || "View Plans"}{" "}
              <ArrowRight className="w-5 h-5" />
            </a>
            <Link
              href="/login"
              className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl border border-slate-700 transition-all hover:-translate-y-1 flex items-center gap-2 text-lg backdrop-blur-sm"
            >
              {content?.ctaSecondary || "Sign In"}
            </Link>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-500 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
        >
          <span className="text-xs uppercase tracking-[0.2em] font-bold">
            Scroll
          </span>
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="w-[1px] h-12 bg-gradient-to-b from-slate-500 to-transparent"
          />
        </motion.div>
      </div>

      {/* Stats Section */}
      <div className="border-y border-slate-800 bg-slate-900/50 backdrop-blur-xl relative z-10">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-slate-800/50">
            {stats.map((s: any, i: number) => (
              <div key={i} className="text-center">
                <div className="text-4xl font-black text-white mb-1 tabular-nums">
                  <Counter to={Number(s.value) || 0} />
                  {s.suffix || ""}
                </div>
                <div className="text-slate-400 text-sm font-medium uppercase tracking-wider">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Module Story - Sticky Two Column */}
      <div className="py-24 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <FadeIn>
              <h2 className="text-3xl md:text-5xl font-black text-white mb-6 tracking-tight">
                Everything You Need. <br className="hidden md:block" /> Nothing
                You Don't.
              </h2>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto font-light">
                Designed to run the entire shop floor from quoting to dispatch.
              </p>
            </FadeIn>
          </div>

          <div className="grid md:grid-cols-2 gap-16 items-start">
            {/* Left: Sticky Image / Graphic */}
            <div className="sticky top-32 hidden md:block aspect-square rounded-3xl border border-slate-800 bg-slate-900/50 backdrop-blur-md overflow-hidden relative group p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-slate-900/50 z-0"></div>
              {/* Fake dashboard UI representation */}
              <motion.div
                className="relative z-10 w-full h-full border border-slate-700/50 rounded-xl bg-slate-950/80 shadow-2xl flex flex-col overflow-hidden"
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
              >
                <div className="h-10 border-b border-slate-800 flex items-center px-4 gap-2 bg-slate-900/50">
                  <div className="w-3 h-3 rounded-full bg-rose-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500/50"></div>
                </div>
                <div className="p-6 grid grid-cols-2 gap-4 flex-1">
                  <div className="rounded-lg bg-slate-900 border border-slate-800 p-4">
                    <div className="h-2 w-16 bg-slate-700 rounded mb-4"></div>
                    <div className="h-8 w-24 bg-blue-500/20 rounded"></div>
                  </div>
                  <div className="rounded-lg bg-slate-900 border border-slate-800 p-4">
                    <div className="h-2 w-16 bg-slate-700 rounded mb-4"></div>
                    <div className="h-8 w-24 bg-emerald-500/20 rounded"></div>
                  </div>
                  <div className="col-span-2 rounded-lg bg-slate-900 border border-slate-800 p-4 flex-1 mt-4">
                    <div className="h-full w-full border-b border-l border-slate-700 relative">
                      <motion.svg
                        className="absolute inset-0 w-full h-full overflow-visible"
                        preserveAspectRatio="none"
                        viewBox="0 0 100 100"
                      >
                        <motion.path
                          d="M0,100 L20,80 L40,85 L60,40 L80,50 L100,20"
                          fill="none"
                          stroke="url(#grad)"
                          strokeWidth="3"
                          initial={{ pathLength: 0 }}
                          whileInView={{ pathLength: 1 }}
                          transition={{ duration: 1.5, ease: "easeInOut" }}
                        />
                        <defs>
                          <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                          </linearGradient>
                        </defs>
                      </motion.svg>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right: Scrolling Features */}
            <div className="space-y-12 py-10">
              <FadeIn delay={0.1}>
                <motion.div
                  whileHover={{ scale: 1.02, rotateX: 2, rotateY: -2 }}
                  className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 backdrop-blur-sm shadow-xl transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] hover:border-blue-500/30 group"
                  style={{ transformPerspective: 1000 }}
                >
                  <div className="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-300">
                    <Zap className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    Real-time OEE
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    Stop guessing. Get live visibility into Availability,
                    Performance, and Quality metrics for every machine across
                    your entire floor.
                  </p>
                </motion.div>
              </FadeIn>

              <FadeIn delay={0.2}>
                <motion.div
                  whileHover={{ scale: 1.02, rotateX: 2, rotateY: -2 }}
                  className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 backdrop-blur-sm shadow-xl transition-all hover:shadow-[0_0_30px_rgba(244,63,94,0.15)] hover:border-rose-500/30 group"
                  style={{ transformPerspective: 1000 }}
                >
                  <div className="w-14 h-14 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-rose-500/20 transition-all duration-300">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    Digital Work Orders
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    Ditch the paperwork. Route jobs directly to operator tablets
                    with embedded digital drawings, BOMs, and routing steps.
                  </p>
                </motion.div>
              </FadeIn>

              <FadeIn delay={0.3}>
                <motion.div
                  whileHover={{ scale: 1.02, rotateX: 2, rotateY: -2 }}
                  className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 backdrop-blur-sm shadow-xl transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] hover:border-emerald-500/30 group"
                  style={{ transformPerspective: 1000 }}
                >
                  <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all duration-300">
                    <Activity className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    Aero Compliance
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    Deep serial traceability, AS9102 First Article Inspections,
                    NCRs, Hold Points, and one-click Data Package generation.
                  </p>
                </motion.div>
              </FadeIn>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div
        id="pricing"
        className="py-24 relative z-10 bg-slate-950 border-t border-slate-900"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <FadeIn>
              <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
                Simple, Transparent Pricing
              </h2>
              <p className="text-lg text-slate-400">
                Choose the plan that fits your production scale.
              </p>
            </FadeIn>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Pilot */}
            <FadeIn delay={0.1}>
              <div className="bg-slate-900/50 rounded-3xl p-8 border border-slate-800 shadow-xl flex flex-col h-full hover:border-slate-700 transition-all">
                <h3 className="text-xl font-bold text-white mb-2">Pilot</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Perfect for testing the waters.
                </p>
                <div className="mb-8">
                  <span className="text-4xl font-black text-white tabular-nums">
                    ₹15,000
                  </span>
                  <span className="text-slate-500"> / once</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {[
                    "60 days access",
                    "Unlimited machines",
                    "All features included",
                    "Dedicated onboarding",
                  ].map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 text-slate-300 text-sm"
                    >
                      <Check className="w-5 h-5 text-emerald-500 shrink-0" />{" "}
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="#contact"
                  className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-center transition-colors"
                >
                  Start Pilot
                </a>
              </div>
            </FadeIn>

            {/* Starter */}
            <FadeIn delay={0.2} className="relative z-10 md:-translate-y-6">
              <div className="bg-gradient-to-b from-blue-900/80 to-blue-950/80 backdrop-blur-md rounded-3xl p-8 border border-blue-500/50 shadow-[0_0_40px_rgba(37,99,235,0.2)] flex flex-col h-full relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-400 to-blue-500"></div>
                <div className="absolute top-4 right-4 bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-blue-500/30">
                  Most Popular
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Starter</h3>
                <p className="text-blue-200/70 text-sm mb-6">
                  For small to medium shops.
                </p>
                <div className="mb-8">
                  <span className="text-4xl font-black text-white tabular-nums">
                    ₹4,999
                  </span>
                  <span className="text-blue-300/50"> / mo</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {[
                    "Up to 5 active machines",
                    "Real-time OEE Dashboard",
                    "Operator Terminal",
                    "Basic Reports",
                    "Standard Support",
                  ].map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 text-blue-50 text-sm"
                    >
                      <Check className="w-5 h-5 text-blue-400 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="#contact"
                  className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-center transition-all shadow-lg shadow-blue-500/20"
                >
                  Get Started
                </a>
              </div>
            </FadeIn>

            {/* Growth */}
            <FadeIn delay={0.3}>
              <div className="bg-slate-900/50 rounded-3xl p-8 border border-slate-800 shadow-xl flex flex-col h-full hover:border-slate-700 transition-all">
                <h3 className="text-xl font-bold text-white mb-2">Growth</h3>
                <p className="text-slate-400 text-sm mb-6">
                  For scaling manufacturing setups.
                </p>
                <div className="mb-8">
                  <span className="text-4xl font-black text-white tabular-nums">
                    ₹9,999
                  </span>
                  <span className="text-slate-500"> / mo</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {[
                    "Up to 15 active machines",
                    "AI Analyst Access",
                    "Customer Portal",
                    "Full Print Center",
                  ].map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 text-slate-300 text-sm"
                    >
                      <Check className="w-5 h-5 text-emerald-500 shrink-0" />{" "}
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="#contact"
                  className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-center transition-colors"
                >
                  Contact Sales
                </a>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>

      {/* Lead Form */}
      <div
        id="contact"
        className="py-24 relative z-10 border-t border-slate-800/50 bg-slate-950"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-slate-800 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12"
                >
                  <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                    <Check className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-4 tracking-tight">
                    Request Received!
                  </h3>
                  <p className="text-slate-400">
                    We'll be in touch shortly to set up your account.
                  </p>
                </motion.div>
              ) : (
                <>
                  <div className="text-center mb-10">
                    <h2 className="text-3xl font-black text-white mb-4 tracking-tight">
                      Start Your Pilot
                    </h2>
                    <p className="text-slate-400">
                      Leave your details and our team will get you onboarded.
                    </p>
                  </div>
                  <form
                    onSubmit={handleSubmit}
                    className="space-y-6 relative z-10"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Company Name
                        </label>
                        <input
                          type="text"
                          required
                          value={form.company}
                          onChange={(e) =>
                            setForm({ ...form, company: e.target.value })
                          }
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-600"
                          placeholder="Acme Corp"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Contact Name
                        </label>
                        <input
                          type="text"
                          required
                          value={form.contactName}
                          onChange={(e) =>
                            setForm({ ...form, contactName: e.target.value })
                          }
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-600"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Phone
                        </label>
                        <input
                          type="tel"
                          required
                          value={form.phone}
                          onChange={(e) =>
                            setForm({ ...form, phone: e.target.value })
                          }
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-600"
                          placeholder="+91 99999 99999"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Work Email
                        </label>
                        <input
                          type="email"
                          required
                          value={form.email}
                          onChange={(e) =>
                            setForm({ ...form, email: e.target.value })
                          }
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-600"
                          placeholder="john@acme.com"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-4 mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] disabled:opacity-50"
                    >
                      {loading ? "Submitting..." : "Submit Request"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 text-center text-slate-600 text-sm border-t border-slate-900 relative z-10 bg-slate-950">
        &copy; {new Date().getFullYear()}{" "}
        {content?.appName || "Manufacturing Max"}. All rights reserved.
      </footer>
    </div>
  );
}
