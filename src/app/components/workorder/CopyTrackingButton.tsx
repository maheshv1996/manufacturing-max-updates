"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export default function CopyTrackingButton({
  trackingToken,
  woNumber,
  className = "",
}: {
  trackingToken?: string | null;
  woNumber: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const tokenToUse = trackingToken || woNumber;
    const trackingUrl = `${window.location.origin}/track/${tokenToUse}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(trackingUrl);
      } else {
        // Fallback for older browsers
        const input = document.createElement("input");
        input.value = trackingUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      logClientError("Failed to copy tracking link:", err, "CopyTrackingButton");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy Public Tracking Link for ${woNumber}`}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
        copied
          ? "bg-emerald-950 border-emerald-700 text-emerald-300 dark:bg-emerald-950 dark:border-emerald-700 text-emerald-300"
          : "bg-slate-800/60 hover:bg-blue-50 hover:bg-slate-700 text-slate-200 border-slate-600 hover:border-blue-400"
      } ${className}`}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>Tracking Link Copied!</span>
        </>
      ) : (
        <>
          <Share2 className="w-3.5 h-3.5 text-blue-500" />
          <span>Copy Tracking Link</span>
        </>
      )}
    </button>
  );
}
