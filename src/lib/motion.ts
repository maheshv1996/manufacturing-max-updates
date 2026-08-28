"use client";

import { useEffect, useState } from "react";

// One easing curve everywhere — Apple's signature easeOutQuint-ish
// `cubic-bezier(0.16, 1, 0.3, 1)`: fast start, long luxurious settle.
// Used for route transitions, panel entrances, and hover lifts so every
// animation in the app shares the same "premium" feel.
export const PREMIUM_EASE = [0.16, 1, 0.3, 1] as const;

// Device capability tier. Low-end machines (few cores, no WebGL, or the
// OS asking for reduced motion) get trimmed effects — fewer layers, no
// WebGL canvas, no 3D tilt — so motion is BUTTER-SMOOTH everywhere
// instead of ambitious-but-janky on weak hardware.
export function useDeviceTier(): "high" | "low" {
  const [tier, setTier] = useState<"high" | "low">("high");

  useEffect(() => {
    let low = false;
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
      low = !!reduced || weakCpu || !webgl;
    } catch {
      low = false;
    }
    setTier(low ? "low" : "high");
  }, []);

  return tier;
}
