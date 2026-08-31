export const tokens = {
  color: {
    bg: {
      primary: "bg-slate-950",
      secondary: "bg-slate-900",
      tertiary: "bg-slate-800",
      elevated: "bg-slate-800/80",
      card: "bg-slate-800/50",
      cardHover: "bg-slate-800/80",
      overlay: "bg-black/70",
    },
    border: {
      primary: "border-slate-700",
      secondary: "border-slate-600",
      accent: "border-slate-600",
      focus: "border-blue-500",
      glass: "border-white/10",
      glassHover: "border-white/20",
      glassStrong: "border-white/30",
    },
    text: {
      primary: "text-white",
      secondary: "text-slate-300",
      tertiary: "text-slate-400",
      muted: "text-slate-500",
      inverse: "text-slate-900",
      accent: "text-blue-400",
      accentHover: "text-blue-300",
    },
    accent: {
      blue: "bg-blue-500",
      blueHover: "bg-blue-400",
      blueSoft: "bg-blue-500/10",
      blueBorder: "border-blue-500/30",
      emerald: "bg-emerald-500",
      emeraldSoft: "bg-emerald-500/10",
      emeraldBorder: "border-emerald-500/30",
      amber: "bg-amber-500",
      amberSoft: "bg-amber-500/10",
      amberBorder: "border-amber-500/30",
      rose: "bg-rose-500",
      roseSoft: "bg-rose-500/10",
      roseBorder: "border-rose-500/30",
      purple: "bg-purple-500",
      purpleSoft: "bg-purple-500/10",
      purpleBorder: "border-purple-500/30",
      cyan: "bg-cyan-500",
      cyanSoft: "bg-cyan-500/10",
      cyanBorder: "border-cyan-500/30",
      indigo: "bg-indigo-500",
      indigoSoft: "bg-indigo-500/10",
      indigoBorder: "border-indigo-500/30",
    },
    status: {
      live: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      partial: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      planned: "bg-slate-500/10 text-slate-400 border-slate-500/30",
      draft: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      inProgress: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      onHold: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      running: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
      warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      danger: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    },
  },
  spacing: {
    xs: "p-1",
    sm: "p-2",
    md: "p-4",
    lg: "p-6",
    xl: "p-8",
    "2xl": "p-10",
    gap: {
      xs: "gap-1",
      sm: "gap-2",
      md: "gap-4",
      lg: "gap-6",
      xl: "gap-8",
    },
  },
  radius: {
    sm: "rounded-lg",
    md: "rounded-xl",
    lg: "rounded-2xl",
    xl: "rounded-3xl",
    full: "rounded-full",
  },
  shadow: {
    sm: "shadow-sm",
    md: "shadow-md",
    lg: "shadow-lg",
    xl: "shadow-xl",
    "2xl": "shadow-2xl",
    glowBlue: "shadow-[0_0_30px_rgba(59,130,246,0.10)]",
    glowEmerald: "shadow-[0_0_30px_rgba(16,185,129,0.10)]",
    glowAmber: "shadow-[0_0_30px_rgba(245,158,11,0.10)]",
    glowRose: "shadow-[0_0_30px_rgba(251,113,133,0.10)]",
    glowPurple: "shadow-[0_0_30px_rgba(168,85,247,0.10)]",
    glowCyan: "shadow-[0_0_30px_rgba(6,182,212,0.10)]",
    inner: "shadow-inner",
    glass: "shadow-[0_4px_24px_rgba(0,0,0,0.32),0_0_36px_rgba(99,102,241,0.06)]",
    glassHover: "shadow-[0_8px_32px_rgba(0,0,0,0.42),0_0_44px_rgba(99,102,241,0.09)]",
  },
  transition: {
    fast: "transition-all duration-150 ease-out",
    normal: "transition-all duration-200 ease-out",
    slow: "transition-all duration-300 ease-out motion-reduce:transition-none",
    spring: "transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
    cinematic: "transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
  },
  typography: {
    display: "text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight",
    displayCinematic:
      "text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter bg-gradient-to-r from-white via-slate-300 to-indigo-300 bg-clip-text text-transparent",
    h1: "text-3xl sm:text-4xl font-black tracking-tight",
    h2: "text-2xl sm:text-3xl font-bold tracking-tight",
    h3: "text-xl sm:text-2xl font-bold tracking-tight",
    h4: "text-lg font-semibold tracking-tight",
    body: "text-base leading-relaxed",
    bodySm: "text-sm leading-relaxed",
    caption: "text-xs leading-normal",
    mono: "font-mono tabular-nums",
    label: "text-xs font-semibold uppercase tracking-wider",
  },
  layout: {
    container: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
    containerWide: "max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8",
    section: "space-y-6 lg:space-y-8",
    grid: {
      kpi: "grid grid-cols-2 md:grid-cols-4 gap-4",
      content: "grid grid-cols-1 lg:grid-cols-3 gap-6",
      sections: "grid grid-cols-1 xl:grid-cols-2 gap-6",
      dept: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
    },
  },
  glass: {
    light: "bg-white/4 backdrop-blur-xl border border-white/8",
    medium: "bg-white/7 backdrop-blur-2xl border border-white/12",
    heavy: "bg-white/10 backdrop-blur-2xl border border-white/16",
    dark: "bg-black/40 backdrop-blur-xl border border-white/5",
    card: "bg-slate-800/45 backdrop-blur-2xl border border-white/8",
    cardHover: "bg-slate-800/70 backdrop-blur-2xl border border-white/16",
    modal: "bg-slate-900/90 backdrop-blur-2xl border border-white/12",
    premium:
      "bg-gradient-to-br from-white/8 via-slate-800/45 to-slate-900/80 backdrop-blur-2xl border border-white/8",
    premiumHover:
      "bg-gradient-to-br from-white/12 via-slate-800/55 to-slate-900/90 backdrop-blur-2xl border border-white/16",
  },
  gradient: {
    auroraBlue: "bg-gradient-to-br from-blue-500/12 via-transparent to-purple-500/12",
    auroraEmerald: "bg-gradient-to-br from-emerald-500/12 via-transparent to-cyan-500/12",
    auroraAmber: "bg-gradient-to-br from-amber-500/12 via-transparent to-orange-500/12",
    auroraRose: "bg-gradient-to-br from-rose-500/12 via-transparent to-pink-500/12",
    auroraCyan: "bg-gradient-to-br from-cyan-500/12 via-transparent to-blue-500/12",
    mesh: "bg-[radial-gradient(ellipse_at_20%_20%,rgba(59,130,246,0.07)_0%,transparent_50%),radial-gradient(ellipse_at_80%_80%,rgba(168,85,247,0.06)_0%,transparent_50%),radial-gradient(ellipse_at_50%_50%,rgba(6,182,212,0.04)_0%,transparent_40%)]",
    meshWarm:
      "bg-[radial-gradient(ellipse_at_20%_20%,rgba(245,158,11,0.06)_0%,transparent_50%),radial-gradient(ellipse_at_80%_80%,rgba(251,113,133,0.06)_0%,transparent_50%),radial-gradient(ellipse_at_50%_50%,rgba(236,72,153,0.04)_0%,transparent_40%)]",
    cardAccent: "bg-gradient-to-br from-white/5 via-transparent to-white/2",
    cardAccentHover: "bg-gradient-to-br from-white/10 via-transparent to-white/5",
  },
  focus:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
} as const;

export type Tokens = typeof tokens;

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Universal Tone & Status Badge Style Normalizer.
 * Handles snake_case, kebab-case, camelCase, and UPPERCASE values across ERP/MES modules.
 */
export function toneClass(tone: string): string {
  if (!tone) return "bg-slate-500/10 text-slate-400 border-slate-500/30";

  const key = tone
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  // Success / Positive / Conforming
  if (
    [
      "ok",
      "pass",
      "passed",
      "approved",
      "active",
      "live",
      "completed",
      "conforming",
      "resolved",
      "success",
      "healthy",
      "verified",
      "certified",
      "closed_won",
      "released",
      "dispatched",
      "cleared",
    ].includes(key)
  ) {
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  }

  // Warning / Pending / In-Review / Attention
  if (
    [
      "warn",
      "warning",
      "partial",
      "on_hold",
      "onhold",
      "hold",
      "expiring_soon",
      "pending",
      "in_review",
      "under_review",
      "review",
      "quarantine",
      "attention",
      "stalled",
      "delayed",
      "maintenance_due",
      "rework",
    ].includes(key)
  ) {
    return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  }

  // Danger / Critical / Failed / Scrap
  if (
    [
      "danger",
      "critical",
      "fail",
      "failed",
      "rejected",
      "expired",
      "suspended",
      "breached",
      "non_conforming",
      "scrap",
      "error",
      "overdue",
      "blocked",
      "high_risk",
      "unhealthy",
      "breakdown",
    ].includes(key)
  ) {
    return "bg-rose-500/10 text-rose-400 border-rose-500/30";
  }

  // Info / In-Progress / Running / Queued
  if (
    [
      "info",
      "draft",
      "in_progress",
      "inprogress",
      "running",
      "open",
      "new",
      "blue",
      "cyan",
      "processing",
      "scheduled",
      "assigned",
      "submitted",
      "queued",
      "monitoring",
    ].includes(key)
  ) {
    return "bg-sky-500/10 text-sky-400 border-sky-500/30";
  }

  // R&D / Special / Prototype
  if (
    [
      "rnd",
      "prototype",
      "experimental",
      "custom",
      "special",
      "purple",
      "violet",
    ].includes(key)
  ) {
    return "bg-purple-500/10 text-purple-400 border-purple-500/30";
  }

  // Planned / Neutral / Archived / Default
  return "bg-slate-500/10 text-slate-400 border-slate-500/30";
}

export function statusBadge(status: string, size: "sm" | "md" = "sm") {
  const padding =
    size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-xs";
  return `${padding} font-semibold rounded-full border ${toneClass(status)}`;
}

export function glassCard(
  variant: "default" | "premium" | "modal" = "default",
  hover = false,
) {
  const base = {
    default:
      "bg-slate-800/45 backdrop-blur-2xl border border-white/8 shadow-[0_4px_24px_rgba(0,0,0,0.32),0_0_36px_rgba(99,102,241,0.06)]",
    premium:
      "bg-gradient-to-br from-white/8 via-slate-800/45 to-slate-900/80 backdrop-blur-2xl border border-white/8 shadow-[0_4px_24px_rgba(0,0,0,0.32),0_0_36px_rgba(99,102,241,0.06)]",
    modal:
      "bg-slate-900/90 backdrop-blur-2xl border border-white/12 shadow-[0_12px_40px_rgba(0,0,0,0.5)]",
  };
  const hoverCls = hover
    ? {
        default:
          "hover:bg-slate-800/70 hover:border-white/16 hover:shadow-[0_8px_32px_rgba(0,0,0,0.42),0_0_44px_rgba(99,102,241,0.09)] motion-safe:hover:-translate-y-0.5 motion-reduce:transform-none",
        premium:
          "hover:bg-slate-800/60 hover:border-white/16 hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_0_52px_rgba(99,102,241,0.11)] motion-safe:hover:-translate-y-0.5 motion-reduce:transform-none",
        modal: "",
      }[variant]
    : "";
  return cn(base[variant], hoverCls, "transition-all duration-300 ease-out motion-reduce:transition-none");
}
