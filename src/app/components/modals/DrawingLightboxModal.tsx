"use client";

import { logClientError } from "@/lib/clientLogger";
/* eslint-disable @next/next/no-img-element -- document fileUrl is dynamic blob/PDF endpoint, not optimizable via next/image */

import { useEffect } from "react";
import { X, FileText, Download, ShieldCheck, Info } from "lucide-react";
import { offlineFetchWrapper } from "@/lib/offlineSync";

interface DocumentItem {
  id: string;
  title: string;
  version: number;
  mimeType: string;
  sizeKb: number;
  status: "CURRENT" | "ARCHIVED";
  uploadedBy?: string;
  uploadedAt?: string;
  notes?: string | null;
  product?: { name: string; sku: string };
  operation?: { name: string; code: string };
}

interface DrawingLightboxModalProps {
  document: DocumentItem;
  operatorName?: string;
  woNumber?: string;
  onClose: () => void;
}

export default function DrawingLightboxModal({
  document: doc,
  operatorName,
  woNumber,
  onClose,
}: DrawingLightboxModalProps) {
  // Log DRAWING_VIEWED audit event on mount
  useEffect(() => {
    const logView = async () => {
      try {
        await offlineFetchWrapper("/api/docs/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: doc.id,
            title: doc.title,
            version: doc.version,
            productName: doc.product?.name || "Product",
            operatorName: operatorName || "User",
            woNumber: woNumber || "N/A",
          }),
        });
      } catch (err) {
        logClientError("Failed to log drawing view audit:", err, "DrawingLightboxModal");
      }
    };
    logView();
  }, [
    doc.id,
    doc.title,
    doc.version,
    doc.product?.name,
    operatorName,
    woNumber,
  ]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const fileUrl = `/api/docs/${doc.id}/file`;
  const isPdf = doc.mimeType?.toLowerCase().includes("pdf");
  const isCurrent = doc.status === "CURRENT";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-drawing-title"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-xl p-4 sm:p-6 text-white select-none overflow-hidden"
    >
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 sm:px-6 rounded-2xl shadow-2xl shrink-0">
        <div className="flex items-start sm:items-center gap-4">
          <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
            <FileText className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 id="lightbox-drawing-title" className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {doc.title}
              </h2>
              <span
                className={`px-3 py-1 text-xs font-black font-mono rounded-full border shadow-sm ${
                  isCurrent
                    ? "bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold animate-pulse"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                REV {doc.version} - {doc.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
              <span>
                Product: <strong>{doc.product?.name || "N/A"}</strong> (
                {doc.product?.sku})
              </span>
              {doc.operation && (
                <>
                  <span>•</span>
                  <span>
                    Operation:{" "}
                    <strong>
                      Op {doc.operation.code} ({doc.operation.name})
                    </strong>
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <a
            href={fileUrl}
            download={doc.title}
            aria-label={`Download file ${doc.title}`}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Download original file"
          >
            <Download className="w-4 h-4 text-blue-400" aria-hidden="true" />
            Download File
          </a>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawing lightbox"
            className="p-2.5 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors cursor-pointer"
            title="Close Lightbox (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* NOTES BANNER IF PRESENT */}
      {doc.notes && (
        <div className="mt-3 px-5 py-2.5 bg-blue-950/40 border border-blue-800/60 rounded-xl text-blue-200 text-xs flex items-center gap-2 shrink-0">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            <strong>Engineering Note:</strong> {doc.notes}
          </span>
        </div>
      )}

      {/* VIEWPORT AREA */}
      <div className="flex-1 my-4 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden relative flex items-center justify-center p-2 sm:p-4">
        {isPdf ? (
          <iframe
            src={fileUrl}
            className="w-full h-full rounded-xl border-0 bg-white"
            title={doc.title}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
            <img
              src={fileUrl}
              alt={doc.title}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-slate-800"
            />
          </div>
        )}
      </div>

      {/* FOOTER AUDIT STAMP */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono shrink-0 px-2">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Revision Verification: Station Lightbox Verified Active Version (REV{" "}
          {doc.version})
        </span>
        <span>
          Viewer: {operatorName || "Shopfloor User"} •{" "}
          {new Date().toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
