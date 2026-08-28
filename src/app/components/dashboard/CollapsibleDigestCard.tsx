"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Coffee,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { DigestData } from "@/lib/digestData";

export default function CollapsibleDigestCard({
  digest,
}: {
  digest: DigestData;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isOeeUp = digest.oeeDelta >= 0;

  return (
    <div className="mb-6 bg-slate-800/60 border-2 border-accent/20 dark:border-accent-500/30 rounded-xl shadow-sm overflow-hidden var-accent-border">
      <div
        className="p-4 bg-accent/10 dark:bg-accent-900/20 flex items-center justify-between cursor-pointer hover:bg-accent/15 transition-colors var-accent-bg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent text-white rounded-lg shadow-sm var-accent-bg">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-accent-300 var-accent-text uppercase tracking-wider">
              Yesterday's Digest
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-lg font-black text-white">
                {digest.oee.toFixed(1)}% OEE
              </span>
              <span
                className={`text-xs font-bold flex items-center ${isOeeUp ? "text-emerald-500" : "text-rose-500"}`}
              >
                {isOeeUp ? (
                  <ArrowUp className="w-3 h-3 mr-0.5" />
                ) : (
                  <ArrowDown className="w-3 h-3 mr-0.5" />
                )}
                {Math.abs(digest.oeeDelta).toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/digest"
            className="hidden sm:block text-xs font-semibold text-accent-400 hover:underline var-accent-text"
            onClick={(e) => e.stopPropagation()}
          >
            Full digest â†’
          </Link>
          <div className="text-slate-400">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-5 border-t border-accent/10 dark:border-accent-800/30 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-800/60">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Output
            </p>
            <p className="text-sm font-bold text-white mt-1">
              <span className="text-emerald-400">
                {digest.totalGood.toLocaleString()} good
              </span>
              <span className="text-slate-400 mx-1">/</span>
              <span className="text-rose-400">
                {digest.totalScrap.toLocaleString()} scrap
              </span>
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Downtime
            </p>
            <p className="text-sm font-bold text-white mt-1">
              {digest.totalDowntimeMin} min
              {digest.topDowntimeReason && (
                <span className="text-slate-500 font-medium ml-1">
                  ({digest.topDowntimeReason})
                </span>
              )}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Top Performer
            </p>
            <p className="text-sm font-bold text-white mt-1">
              {digest.bestMachine ? (
                <>
                  ðŸ¥‡ {digest.bestMachine.name}{" "}
                  <span className="text-emerald-600 font-medium ml-1">
                    {digest.bestMachine.oee.toFixed(1)}%
                  </span>
                </>
              ) : (
                "N/A"
              )}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Needs Attention
            </p>
            <p className="text-sm font-bold text-rose-400 mt-1">
              {digest.attentionNeeded.length > 0 ? (
                <>âš ï¸ {digest.attentionNeeded.join(", ")}</>
              ) : (
                <span className="text-emerald-600">
                  All machines hitting targets
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
