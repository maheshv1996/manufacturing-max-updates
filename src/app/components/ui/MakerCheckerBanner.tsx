"use client";

import { useState } from "react";
import { Check, X, Clock, Stamp } from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";

interface MakerCheckerProps {
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  submittedBy: string;
  submittedAt: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  canApprove: boolean;
  onApprove: (remarks: string) => Promise<void> | void;
  onReject: (reason: string) => Promise<void> | void;
}

export default function MakerCheckerBanner({
  status,
  submittedBy,
  submittedAt,
  approvedBy,
  approvedAt,
  canApprove,
  onApprove,
  onReject,
}: MakerCheckerProps) {
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const handleApproveAction = async () => {
    setBusy(true);
    try {
      await onApprove(remarks);
      soundFx.playSuccess();
      toast.success("Document approved & signed!");
    } finally {
      setBusy(false);
    }
  };

  const handleRejectAction = async () => {
    if (!remarks.trim()) {
      toast.error("Please enter a rejection reason");
      return;
    }
    setBusy(true);
    try {
      await onReject(remarks);
      soundFx.playClick();
      toast.error("Document rejected with remarks");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`p-4 rounded-2xl border font-mono text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        status === "APPROVED"
          ? "bg-emerald-500/10 border-emerald-500/30"
          : status === "REJECTED"
          ? "bg-red-500/10 border-red-500/30"
          : "bg-amber-500/10 border-amber-500/30"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`p-2.5 rounded-xl ${
            status === "APPROVED"
              ? "bg-emerald-500/20 text-emerald-300"
              : status === "REJECTED"
              ? "bg-red-500/20 text-red-300"
              : "bg-amber-500/20 text-amber-300 animate-pulse"
          }`}
        >
          {status === "APPROVED" ? (
            <Stamp className="w-5 h-5" />
          ) : status === "REJECTED" ? (
            <X className="w-5 h-5" />
          ) : (
            <Clock className="w-5 h-5" />
          )}
        </div>

        <div>
          <div className="font-black text-white flex items-center gap-2">
            <span>Maker-Checker Status:</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] ${
                status === "APPROVED"
                  ? "bg-emerald-500/30 text-emerald-200"
                  : status === "REJECTED"
                  ? "bg-red-500/30 text-red-200"
                  : "bg-amber-500/30 text-amber-200"
              }`}
            >
              {status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-[11px] text-white/60 mt-0.5">
            Submitted by: {submittedBy} on {new Date(submittedAt).toLocaleDateString()}
            {approvedBy && ` • Signed by: ${approvedBy} on ${new Date(approvedAt!).toLocaleDateString()}`}
          </p>
        </div>
      </div>

      {status === "PENDING_APPROVAL" && canApprove && (
        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Remarks / Approval Note"
            className="h-8 rounded-xl bg-black/50 border border-white/20 px-3 text-xs text-white font-mono placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
          />
          <button
            disabled={busy}
            onClick={handleApproveAction}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Approve</span>
          </button>
          <button
            disabled={busy}
            onClick={handleRejectAction}
            className="px-3.5 py-1.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <X className="w-3.5 h-3.5 stroke-[3]" />
            <span>Reject</span>
          </button>
        </div>
      )}
    </div>
  );
}
