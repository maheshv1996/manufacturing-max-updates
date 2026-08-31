"use client";

import { useState, useEffect, useRef } from "react";
import { useInView, useReducedMotion } from "framer-motion";

export function AnimatedCounter({
  to,
  duration = 1.5,
  formatter = (v: number) => v.toString(),
}: {
  to: number;
  duration?: number;
  formatter?: (v: number) => string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [count, setCount] = useState(shouldReduceMotion ? to : 0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (shouldReduceMotion) {
      setCount(to);
      return;
    }

    if (isInView) {
      let startTime: number | null = null;
      const start = 0;

      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min(
          (timestamp - startTime) / (duration * 1000),
          1,
        );

        // easeOut cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        setCount(start + (to - start) * easeOut);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [to, duration, isInView, shouldReduceMotion]);

  return <span ref={ref}>{formatter(count)}</span>;
}
