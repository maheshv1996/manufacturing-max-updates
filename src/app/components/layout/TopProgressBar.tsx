"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function TopProgressBar() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[150] h-0.5 bg-transparent overflow-hidden pointer-events-none">
      <div className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 animate-[shimmer_0.8s_ease-in-out_infinite] shadow-[0_0_12px_rgba(6,182,212,0.8)]" />
    </div>
  );
}
