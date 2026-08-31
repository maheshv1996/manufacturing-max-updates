"use client";

import { useEffect, useState } from "react";

// One easing curve everywhere — Apple's signature easeOutQuint-ish
// `cubic-bezier(0.16, 1, 0.3, 1)`: fast start, long luxurious settle.
// Used for route transitions, panel entrances, and hover lifts so every
// animation in the app shares the same "premium" feel.
export const PREMIUM_EASE = [0.16, 1, 0.3, 1] as const;

export const MOTION_TRANSITIONS = {
  instant: { duration: 0 },
  fast: { duration: 0.2, ease: PREMIUM_EASE },
  normal: { duration: 0.35, ease: PREMIUM_EASE },
  gentle: { duration: 0.5, ease: PREMIUM_EASE },
  spring: { type: "spring", stiffness: 300, damping: 25 },
} as const;

// Device capability tier. Low-end machines (few cores, no WebGL, or the
// OS asking for reduced motion) get trimmed effects — fewer layers, no
// WebGL canvas, no 3D tilt — so motion is BUTTER-SMOOTH everywhere
// instead of ambitious-but-janky on weak hardware.
function detectDeviceTier(): "high" | "low" {
  if (typeof window === "undefined") return "high";
  try {
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    const weakCpu = (navigator.hardwareConcurrency ?? 8) <= 4;
    let webgl = false;
    try {
      const c = document.createElement("canvas");
      webgl = !!(
        window.WebGLRenderingContext &&
        (c.getContext("webgl2") || c.getContext("webgl"))
      );
    } catch {
      webgl = false;
    }
    return reduced || weakCpu || !webgl ? "low" : "high";
  } catch {
    return "high";
  }
}

export function useDeviceTier(): "high" | "low" {
  const [tier, setTier] = useState<"high" | "low">("high");

  useEffect(() => {
    const t = detectDeviceTier();
    setTier(t);
  }, []);

  return tier;
}

/** Convenience boolean hook for tier-aware conditional rendering */
export function useIsLowTier(): boolean {
  const tier = useDeviceTier();
  return tier === "low";
}

/** Reusable motion variants that adapt seamlessly to device capability */
export const fadeInUpVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: PREMIUM_EASE },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};
