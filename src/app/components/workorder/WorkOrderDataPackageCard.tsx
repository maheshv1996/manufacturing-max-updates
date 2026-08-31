"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSignature, Loader2, Eye, Lock } from "lucide-react";
import Link from "next/link";

export default function WorkOrderDataPackageCard({ wo }: { wo: any }) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  const dataPackage = wo.dataPackages?.[0]; // Get most recent

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      const res = await fetch("/api/data-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workOrderId: wo.id }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to generate");
      }
    } catch (err) {
      logClientError(err, "WorkOrderDataPackageCard");
      alert("Error generating data package");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRelease = async () => {
    if (!confirm("Are you sure? Releasing freezes this data package forever."))
      return;
    try {
      setIsReleasing(true);
      const res = await fetch(`/api/data-package/${dataPackage.id}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releasedBy: "System Operator" }), // Replace with actual user context later
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to release");
      }
    } catch (err) {
      logClientError(err, "WorkOrderDataPackageCard");
      alert("Error releasing data package");
    } finally {
      setIsReleasing(false);
    }
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-indigo-500" />
          Data Package (Birth Record)
        </h3>
        {dataPackage && (
          <span
            className={`px-2.5 py-1 text-xs font-bold border rounded-full ${
              dataPackage.status === "RELEASED"
                ? "bg-slate-800/60 text-slate-300 border-slate-600"
                : "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/60 text-amber-300 dark:border-amber-800"
            }`}
          >
            {dataPackage.status}
          </span>
        )}
      </div>
      <div className="p-6 flex-1 flex flex-col items-center justify-center min-h-[160px] space-y-4">
        {!dataPackage ? (
          <>
            <p className="text-sm text-slate-400 text-center max-w-sm">
              No Data Package exists for this work order yet. Generate one to
              start compiling the birth record.
            </p>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors shadow-sm"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSignature className="w-4 h-4" />
              )}
              Generate Data Package
            </button>
          </>
        ) : (
          <div className="w-full space-y-4">
            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Package Number</p>
                <p className="font-mono font-bold text-white">
                  {dataPackage.packageNumber}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Created</p>
                <p className="font-medium text-white">
                  {new Date(dataPackage.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex gap-3 w-full">
              <Link
                href={`/reports/data-package/${dataPackage.id}`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800/60 border border-slate-600 hover:bg-slate-800/90 text-slate-300 font-medium rounded-lg transition-colors shadow-sm"
              >
                <Eye className="w-4 h-4" />
                View / Print Dossier
              </Link>
              {dataPackage.status === "DRAFT" && (
                <button
                  onClick={handleRelease}
                  disabled={isReleasing}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-500/10 text-slate-300 hover:bg-slate-500/20 font-medium rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isReleasing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Release Package
                </button>
              )}
            </div>
            {dataPackage.status === "RELEASED" && (
              <p className="text-xs text-center text-slate-400 flex items-center justify-center gap-1.5 mt-2">
                <Lock className="w-3 h-3" />
                This package is immutable and frozen.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
