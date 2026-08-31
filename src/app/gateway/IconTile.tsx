"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useDeviceTier } from "@/lib/motion";

interface IconTileProps {
  icon: any;
  label: string;
  sub?: string;
  gradient: string;
  glow: string;
  onClick?: () => void;
  size?: "md" | "lg";
  index?: number;
}

export default function IconTile({
  icon: Icon,
  label,
  sub,
  gradient,
  glow,
  onClick,
  size = "lg",
  index = 0,
}: IconTileProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);

  const sx = useSpring(mx, { stiffness: 260, damping: 22 });
  const sy = useSpring(my, { stiffness: 260, damping: 22 });

  const rotateX = useTransform(sy, [0, 1], [10, -10]);
  const rotateY = useTransform(sx, [0, 1], [-10, 10]);
  const scale = useSpring(1, { stiffness: 320, damping: 18 });

  const [hovered, setHovered] = useState(false);

  const handleMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width);
    my.set((e.clientY - rect.top) / rect.height);
  };

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Low-tier devices get the entrance + glow but skip the 3D tilt —
  // springs on a weak GPU read as jank, not premium.
  const tier = useDeviceTier();
  const tilt = !prefersReduced && tier === "high";

  const dim = size === "lg" ? 64 : 48;

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseEnter={() => {
        if (tilt) scale.set(1.04);
        setHovered(true);
      }}
      onMouseLeave={() => {
        mx.set(0.5);
        my.set(0.5);
        scale.set(1);
        setHovered(false);
      }}
      style={
        tilt
          ? { rotateX, rotateY, scale, transformPerspective: 600 }
          : undefined
      }
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.04,
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="w-full h-full group relative flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5 hover:border-white/25 transition-colors text-center cursor-pointer select-none overflow-hidden"
    >
      {/* hover glow */}
      <span
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          boxShadow: `0 0 60px ${glow}, inset 0 1px 0 rgba(255,255,255,0.12)`,
        }}
      />

      {/* corner arrow on hover */}
      <span
        className={`absolute top-3 right-3 text-white/60 transition-all duration-200 ${hovered ? "opacity-100 translate-x-0 translate-y-0" : "opacity-0 translate-x-1 translate-y-1"}`}
      >
        <ArrowUpRight className="w-4 h-4" />
      </span>

      {/* squircle */}
      <span
        className={`relative flex items-center justify-center text-white bg-gradient-to-br ${gradient} rounded-[22px] shadow-lg`}
        style={{
          width: dim,
          height: dim,
          boxShadow: `0 8px 24px -6px ${glow}, inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -2px 4px rgba(0,0,0,0.2)`,
        }}
      >
        <Icon
          className={size === "lg" ? "w-7 h-7" : "w-5 h-5"}
          strokeWidth={1.8}
        />
      </span>
      <span className="text-sm font-semibold text-white leading-tight">
        {label}
      </span>
      {sub && (
        <span className="text-[11px] text-white/50 leading-snug -mt-2 line-clamp-2">
          {sub}
        </span>
      )}
    </motion.button>
  );
}
