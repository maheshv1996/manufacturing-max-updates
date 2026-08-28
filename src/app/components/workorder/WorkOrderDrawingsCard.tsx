"use client";

import { useState } from "react";
import { FileCheck, FileText, Eye } from "lucide-react";
import DrawingLightboxModal from "@/app/components/modals/DrawingLightboxModal";

interface DocumentItem {
  id: string;
  title: string;
  productId: string;
  operationId?: string | null;
  version: number;
  mimeType: string;
  sizeKb: number;
  status: "CURRENT" | "ARCHIVED";
  uploadedBy: string;
  uploadedAt: string;
  notes?: string | null;
  product?: { name: string; sku: string };
  operation?: { name: string; code: string };
}

interface WorkOrderDrawingsCardProps {
  productName: string;
  woNumber: string;
  documents: DocumentItem[];
}

export default function WorkOrderDrawingsCard({
  productName,
  woNumber,
  documents,
}: WorkOrderDrawingsCardProps) {
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);

  const currentDocs = documents.filter((d) => d.status === "CURRENT");

  return (
    <>
      <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-400 rounded-xl border border-blue-200 dark:border-blue-800">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Station Drawings &amp; SOPs
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Revision-controlled blueprints and assembly procedures for{" "}
                <strong>{productName}</strong>.
              </p>
            </div>
          </div>

          <span className="px-3 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-mono font-bold self-start sm:self-center">
            {currentDocs.length} Active Document(s)
          </span>
        </div>

        {currentDocs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 border border-dashed border-slate-700 rounded-xl space-y-2">
            <FileText className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
            <p className="text-sm font-semibold text-slate-600 text-slate-300">
              No Drawings or SOPs Configured
            </p>
            <p className="text-xs text-slate-400">
              No revision-controlled documents uploaded for this product yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentDocs.map((doc) => (
              <div
                key={doc.id}
                className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3 flex flex-col justify-between hover:border-blue-300 hover:border-blue-700 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-white text-sm line-clamp-2">
                      {doc.title}
                    </h3>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-full font-mono font-black text-[11px] shrink-0">
                      REV {doc.version}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1">
                    <div className="font-mono text-[11px]">
                      {doc.operation ? (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-300 rounded font-bold">
                          Op {doc.operation.code}: {doc.operation.name}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-700/40 text-slate-300 rounded font-medium">
                          Product-Level (All Operations)
                        </span>
                      )}
                    </div>
                    {doc.notes && (
                      <p className="text-[11px] text-slate-400 italic line-clamp-2 pt-1">
                        "{doc.notes}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-600/60 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {doc.mimeType?.split("/")[1]?.toUpperCase() || "FILE"} â€¢{" "}
                    {doc.sizeKb} KB
                  </span>
                  <button
                    onClick={() => setSelectedDoc(doc)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Spec
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedDoc && (
        <DrawingLightboxModal
          document={selectedDoc}
          woNumber={woNumber}
          onClose={() => setSelectedDoc(null)}
        />
      )}
    </>
  );
}
