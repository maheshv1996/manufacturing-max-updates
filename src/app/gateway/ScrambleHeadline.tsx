"use client";

import { motion } from "framer-motion";
import { useScramble } from "./useScramble";

// The decode ticks at 16ms — kept inside this tiny component so the
// 13-tile grid and framer-motion tree never re-render during the reveal.
export default function ScrambleHeadline({
  text,
  enabled,
}: {
  text: string;
  enabled: boolean;
}) {
  const scramble = useScramble(text, enabled);

  return (
    <motion.h1
      className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-tight mb-3 min-h-[4rem] text-balance bg-gradient-to-r from-white via-slate-200 to-blue-300 bg-clip-text text-transparent"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
    >
      {scramble}
    </motion.h1>
  );
}
