"use client";

import { useEffect, useState } from "react";

// Same-width glyphs only — mixed-width junk (dashes, brackets) makes the
// headline visibly jump around mid-decode, which reads as a text glitch.
// A tight alphanumeric alphabet decodes like an intentional hologram
// instead of broken encoding.
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function useScramble(text: string, enabled = true, speed = 2) {
  const [output, setOutput] = useState(enabled ? "" : text);

  useEffect(() => {
    if (!enabled) {
      setOutput(text);
      return;
    }
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      setOutput(text);
      return;
    }
    let frame = 0;
    let interval: ReturnType<typeof setInterval>;
    const total = text.length;
    const tick = () => {
      let out = "";
      const revealed = Math.floor(frame / speed);
      for (let i = 0; i < total; i++) {
        if (i < revealed) out += text[i];
        else out += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      setOutput(out);
      frame++;
      // Reveal roughly one char per `speed` frames; total decode time
      // stays well under a second instead of lingering for many seconds.
      if (frame >= total * speed) {
        setOutput(text);
        clearInterval(interval);
      }
    };
    interval = setInterval(tick, 16);
    return () => clearInterval(interval);
  }, [text, enabled, speed]);

  return output;
}
