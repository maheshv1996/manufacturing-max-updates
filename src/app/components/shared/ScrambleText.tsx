"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface ScrambleTextProps {
  text: string;
  className?: string;
  delay?: number;
}

const CHARS = "!<>-_\\\\/[]{}—=+*^?#________";

export default function ScrambleText({
  text,
  className = "",
  delay = 0,
}: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState("");
  const [, setIsScrambling] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    if (mediaQuery.matches) {
      setDisplayText(text);
      return;
    }

    let timeout: NodeJS.Timeout;
    let interval: NodeJS.Timeout;

    const startScrambling = () => {
      setIsScrambling(true);
      let iteration = 0;

      interval = setInterval(() => {
        setDisplayText(() => {
          return text
            .split("")
            .map((char, index) => {
              if (index < iteration) {
                return text[index];
              }
              if (char === " ") return " ";
              return CHARS[Math.floor(Math.random() * CHARS.length)];
            })
            .join("");
        });

        iteration += 1 / 3;

        if (iteration >= text.length) {
          clearInterval(interval);
          setIsScrambling(false);
          setDisplayText(text);
        }
      }, 30);
    };

    timeout = setTimeout(startScrambling, delay * 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [text, delay]);

  return (
    <motion.span
      className={className}
      initial={{ opacity: prefersReducedMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      {prefersReducedMotion ? text : displayText || " ".repeat(text.length)}
    </motion.span>
  );
}
