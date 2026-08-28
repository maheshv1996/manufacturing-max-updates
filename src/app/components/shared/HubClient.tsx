"use client";
import DashboardCustomizer, {
  KpiCustomizerConfig,
  SectionCustomizerConfig,
} from "./DashboardCustomizer";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronRight,
  ExternalLink,
  ClipboardCheck,
  Users,
  IndianRupee,
  ListTodo,
  CalendarClock,
  CalendarDays,
  Wallet,
  FileClock,
} from "lucide-react";
import Link from "next/link";
import { cn, toneClass } from "@/lib/designTokens";
import SubFunctionGrid from "./SubFunctionGrid";
import BudgetBurnCard from "./BudgetBurnCard";

export function useCountUp(target: number, duration = 900) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);

  return { value };
}

export function CountUp({
  value,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const { value: v } = useCountUp(value);
  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      {v.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

export interface Kpi {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: React.ReactNode;
  tone?: string;
  hint?: string;
  trend?: { value: number; up: boolean };
}

export interface QuickAction {
  label: string;
  href: string;
  icon: React.ReactNode;
  primary?: boolean;
  external?: boolean;
}

export interface HubSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  open?: boolean;
  badge?: { label: string; tone: string };
  body: React.ReactNode;
}

export interface FeedItem {
  time: string;
  title: string;
  detail?: string;
  tone?: "ok" | "warn" | "danger" | "info";
  href?: string;
  meta?: string;
}

const TONE_CLASS: Record<string, string> = {
  ok: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  warn: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  danger: "bg-rose-500/10 text-rose-500 border-rose-500/30",
  info: "bg-sky-500/10 text-sky-500 border-sky-500/30",
};

const TONE_TEXT: Record<string, string> = {
  blue: "text-blue-400",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  purple: "text-purple-400",
  cyan: "text-cyan-400",
  indigo: "text-indigo-400",
  slate: "text-slate-300",
};

function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className={cn(
        "bg-slate-800/60 rounded-2xl border border-slate-700 p-5",
        "hover:bg-slate-800/90 hover:border-slate-600",
        "hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1",
        "transition-all duration-300",
        "group",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-slate-400 text-sm font-medium leading-tight group-hover:text-slate-300 transition-colors">
            {kpi.label}
          </p>
          {kpi.hint && (
            <p className="text-slate-500 text-xs mt-0.5 truncate">{kpi.hint}</p>
          )}
        </div>
        <div className="shrink-0 p-2 bg-slate-800/50 rounded-xl text-slate-400 group-hover:text-slate-300 transition-colors">
          {kpi.icon}
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2 flex-wrap">
        <CountUp
          value={kpi.value}
          prefix={kpi.prefix}
          suffix={kpi.suffix}
          className={cn("text-3xl font-black", TONE_TEXT[kpi.tone || "slate"])}
        />
        {kpi.trend && (
          <span
            className={cn(
              "text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1",
              kpi.trend.up
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-rose-500/10 text-rose-400",
            )}
          >
            {kpi.trend.up ? "▲" : "▼"} {Math.abs(kpi.trend.value)}%
          </span>
        )}
      </div>
    </motion.div>
  );
}

function HubSectionCard({
  section,
  defaultOpen,
}: {
  section: HubSection;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? section.open ?? true);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="bg-slate-800/60 rounded-2xl border border-slate-700 overflow-hidden"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3 text-base font-semibold text-white">
          <span className="p-1.5 bg-slate-800/50 rounded-lg text-slate-300">
            {section.icon}
          </span>
          {section.title}
        </span>
        <div className="flex items-center gap-3">
          {section.badge && (
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                toneClass(section.badge.tone),
              )}
            >
              {section.badge.label}
            </span>
          )}
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="text-slate-400 shrink-0"
          >
            <ChevronRight className="h-4 w-4" />
          </motion.div>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="overflow-hidden border-t border-slate-700/50"
          >
            <div className="p-5">{section.body}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function HubFeed({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  items: FeedItem[];
  empty?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden h-full"
    >
      <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-2.5 text-sm font-semibold text-white">
        <span className="p-1.5 bg-slate-800/50 rounded-lg text-slate-300">
          {icon}
        </span>
        {title}
      </div>
      <div className="divide-y divide-slate-700/50">
        {items.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-800/50 flex items-center justify-center text-slate-500">
              {icon}
            </div>
            <p className="text-slate-400 text-sm">
              {empty || "Nothing here yet."}
            </p>
          </div>
        ) : (
          items.map((it, i) => {
            const href = it.href;
            return (
              <div
                key={i}
                className={cn(
                  "px-5 py-4 flex items-start justify-between gap-4 hover:bg-slate-800/90 transition-colors",
                  href && "cursor-pointer",
                )}
                onClick={
                  href
                    ? () => {
                        window.location.href = href;
                      }
                    : undefined
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    {it.tone && (
                      <span
                        className="shrink-0 h-2 w-2 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            it.tone === "danger"
                              ? "#f43f5e"
                              : it.tone === "warn"
                                ? "#fbbf24"
                                : it.tone === "ok"
                                  ? "#22c55e"
                                  : "#38bdf8",
                        }}
                      />
                    )}
                    <span className="text-sm font-medium text-white truncate">
                      {it.title}
                    </span>
                    {it.meta && (
                      <span className="text-xs text-slate-500 font-medium">
                        {it.meta}
                      </span>
                    )}
                  </div>
                  {it.detail && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {it.detail}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-xs text-slate-500 whitespace-nowrap font-mono">
                    {it.time}
                  </span>
                  {it.tone && (
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                        TONE_CLASS[it.tone],
                      )}
                    >
                      {it.tone.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

function QuickActionButton({ action }: { action: QuickAction }) {
  const isPrimary = action.primary ?? false;
  const isExternal = action.external ?? false;
  return (
    <Link
      href={action.href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm",
        "transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        isPrimary
          ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400 hover:shadow-xl hover:shadow-blue-500/30"
          : "bg-slate-800/60 text-slate-300 border border-slate-700 hover:bg-slate-800/90 hover:border-slate-600 hover:text-white",
      )}
    >
      <span className="p-1 bg-white/5 rounded-lg">{action.icon}</span>
      {action.label}
      {isExternal && <ExternalLink className="h-3 w-3 opacity-60" />}
    </Link>
  );
}

// Level-aware hub workspace: WORKERS get "My" queues; MANAGERS (department
// heads) get Approvals + Team KPIs + Budget. Data comes from /api/auth/me
// (level) + /api/approvals (manager digest, server-gated by level MANAGER).
const MY_QUEUES = [
  {
    label: "My Tasks",
    href: "/ops/floor",
    icon: <ListTodo className="w-4 h-4" />,
    desc: "Live shop-floor work",
  },
  {
    label: "My Requests",
    href: "/people/attendance",
    icon: <CalendarClock className="w-4 h-4" />,
    desc: "Leave requests",
  },
  {
    label: "My Roster",
    href: "/ops/schedule",
    icon: <CalendarDays className="w-4 h-4" />,
    desc: "Shift schedule",
  },
  {
    label: "My Payslips",
    href: "/people/payroll",
    icon: <Wallet className="w-4 h-4" />,
    desc: "Salary slips",
  },
  {
    label: "My Logs",
    href: "/people/handover",
    icon: <FileClock className="w-4 h-4" />,
    desc: "My shift logs",
  },
];

function LevelWorkspace() {
  const [level, setLevel] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const lvl = d?.user?.level || "WORKER";
        setLevel(lvl);
        if (lvl === "MANAGER") {
          fetch("/api/approvals")
            .then((r) => (r.ok ? r.json() : null))
            .then((a) => {
              if (alive) setApprovals(a);
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        setLevel("WORKER");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!level) return null;

  // --- WORKER: "My" queues -----------------------------------------------
  if (level !== "MANAGER") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="bg-slate-800/60 rounded-2xl border border-slate-700 p-5 edge-light"
      >
        <div className="flex items-center gap-2.5 mb-4">
          <span className="p-1.5 bg-slate-800/50 rounded-lg text-slate-300">
            <ListTodo className="w-4 h-4" />
          </span>
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            My Workspace
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {MY_QUEUES.map((q) => (
            <Link
              key={q.label}
              href={q.href}
              className="group flex flex-col items-start gap-2 p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:bg-slate-800/80 hover:border-slate-600 transition-all duration-200 hover:-translate-y-0.5"
            >
              <span className="p-2 rounded-lg bg-white/5 text-slate-300 group-hover:text-white transition-colors">
                {q.icon}
              </span>
              <span className="text-sm font-semibold text-white">
                {q.label}
              </span>
              <span className="text-[11px] text-slate-500">{q.desc}</span>
            </Link>
          ))}
        </div>
      </motion.div>
    );
  }

  // --- MANAGER: Approvals + Team KPIs + Budget ----------------------------
  const a = approvals?.approvals;
  const t = approvals?.team;
  const b = approvals?.budget;
  const pendingTotal =
    (a?.pendingLeaveCount || 0) +
    (a?.disputedCounts || 0) +
    (a?.openNcrs || 0) +
    (a?.submittedFais || 0) +
    (a?.pendingEscalations || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-4"
    >
      {/* Approvals */}
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700 overflow-hidden edge-light lg:col-span-1">
        <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
            <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
              <ClipboardCheck className="w-4 h-4" />
            </span>
            Approvals
          </div>
          <span
            className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full border",
              pendingTotal > 0 ? toneClass("warn") : toneClass("ok"),
            )}
          >
            {pendingTotal} pending
          </span>
        </div>
        <div className="divide-y divide-slate-700/50">
          {a?.pendingLeaves?.length > 0 &&
            a.pendingLeaves.map((l: any) => (
              <Link
                key={l.id}
                href="/people/attendance"
                className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-800/90 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {l.name}{" "}
                    <span className="text-slate-500 font-normal">
                      · {l.employeeNumber}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {l.type} · {l.days} day{l.days !== 1 ? "s" : ""} from{" "}
                    {new Date(l.from).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/30">
                  LEAVE
                </span>
              </Link>
            ))}
          <Link
            href="/mrb"
            className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-800/90 transition-colors"
          >
            <p className="text-sm font-medium text-white">
              Open NCRs awaiting disposition
            </p>
            <span
              className={cn(
                "shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border",
                (a?.openNcrs || 0) > 0 ? toneClass("danger") : toneClass("ok"),
              )}
            >
              {a?.openNcrs || 0}
            </span>
          </Link>
          <Link
            href="/fai"
            className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-800/90 transition-colors"
          >
            <p className="text-sm font-medium text-white">
              FAI submissions to approve
            </p>
            <span
              className={cn(
                "shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border",
                (a?.submittedFais || 0) > 0
                  ? toneClass("warn")
                  : toneClass("ok"),
              )}
            >
              {a?.submittedFais || 0}
            </span>
          </Link>
          <Link
            href="/ops/floor"
            className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-800/90 transition-colors"
          >
            <p className="text-sm font-medium text-white">
              Disputed shift counts
            </p>
            <span
              className={cn(
                "shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border",
                (a?.disputedCounts || 0) > 0
                  ? toneClass("warn")
                  : toneClass("ok"),
              )}
            >
              {a?.disputedCounts || 0}
            </span>
          </Link>
          <Link
            href="/system/escalations"
            className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-800/90 transition-colors"
          >
            <p className="text-sm font-medium text-white">Open escalations</p>
            <span
              className={cn(
                "shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border",
                (a?.pendingEscalations || 0) > 0
                  ? toneClass("danger")
                  : toneClass("ok"),
              )}
            >
              {a?.pendingEscalations || 0}
            </span>
          </Link>
        </div>
      </div>

      {/* Team KPIs */}
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700 p-5 edge-light lg:col-span-1">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Users className="w-4 h-4" />
          </span>
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Team KPIs
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 p-3 text-center">
            <p className="text-2xl font-black text-emerald-400 tabular-nums">
              {t?.presentToday ?? "—"}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">On shift now</p>
          </div>
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 p-3 text-center">
            <p className="text-2xl font-black text-blue-400 tabular-nums">
              {t?.attendanceRate ?? "—"}%
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Attendance</p>
          </div>
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 p-3 text-center">
            <p className="text-2xl font-black text-rose-400 tabular-nums">
              {t?.openNcrs ?? "—"}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Open NCRs</p>
          </div>
        </div>
      </div>

      {/* Budget */}
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700 overflow-hidden edge-light lg:col-span-1">
        <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-2.5 text-sm font-semibold text-white">
          <span className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
            <IndianRupee className="w-4 h-4" />
          </span>
          Budget · {b?.monthLabel || "This month"}
        </div>
        <div className="p-5">
          <p className="text-3xl font-black text-white tabular-nums">
            ₹{Number(b?.monthSpend || 0).toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-slate-400 mt-1">Month-to-date outflow</p>
          <Link
            href="/commercial/treasury"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-slate-200 hover:bg-white/10 hover:border-white/20 transition-all"
          >
            Open Treasury <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function GreetingLine() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.user?.name) setName(d.user.name.split(" ")[0]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!name) return null;
  return (
    <p className="text-sm font-medium text-slate-400">
      Good shift, <span className="text-slate-200 font-semibold">{name}</span>
    </p>
  );
}

export default function HubClient({
  kpis,
  quickActions,
  sections,
  feed,
  feedTitle = "Live Feed",
  feedIcon,
  feedEmpty,
}: {
  kpis: Kpi[];
  quickActions: QuickAction[];
  sections: HubSection[];
  feed: FeedItem[];
  feedTitle?: string;
  feedIcon?: React.ReactNode;
  feedEmpty?: string;
}) {
  // Initialize customizable states based on the props
  const [kpiPrefs, setKpiPrefs] = useState<KpiCustomizerConfig[]>(
    kpis.map((k) => ({ id: k.label, label: k.label, visible: true })),
  );

  const [sectionPrefs, setSectionPrefs] = useState<SectionCustomizerConfig[]>(
    sections.map((s) => ({ id: s.id, label: s.title, visible: true })),
  );

  // Filter based on preferences
  const visibleKpis = kpis.filter(
    (k) => kpiPrefs.find((p) => p.id === k.label)?.visible !== false,
  );
  const visibleSections = sections.filter(
    (s) => sectionPrefs.find((p) => p.id === s.id)?.visible !== false,
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <GreetingLine />
        <DashboardCustomizer
          currentKpis={kpiPrefs}
          currentSections={sectionPrefs}
          onSave={(newKpis, newSections) => {
            setKpiPrefs(newKpis);
            setSectionPrefs(newSections);
          }}
        />
      </div>

      {/* Tile-first: sub-function tiles for this department, with breadcrumb back to the gateway */}
      <SubFunctionGrid />

      {/* Level-aware workspace: WORKER = My queues, MANAGER = Approvals + Team KPIs + Budget */}
      <LevelWorkspace />

      {/* P21 — every department manager sees their own cost-center budget burn */}
      <BudgetBurnCard />

      {/* KPI row */}
      {visibleKpis.length > 0 && (
        <motion.div layout className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AnimatePresence>
            {visibleKpis.map((k) => (
              <motion.div
                key={k.label}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <KpiCard kpi={k} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        {quickActions.map((qa) => (
          <QuickActionButton key={qa.label} action={qa} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Collapsible sections */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence>
            {visibleSections.map((s) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <HubSectionCard section={s} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Live feed */}
        <div className="space-y-4">
          <HubFeed
            title={feedTitle}
            icon={feedIcon}
            items={feed}
            empty={feedEmpty}
          />
        </div>
      </div>
    </div>
  );
}
