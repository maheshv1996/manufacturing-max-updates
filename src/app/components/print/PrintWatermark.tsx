"use client";

export interface PrintWatermarkProps {
  documentTitle: string;
  docControlNumber?: string;
  revision?: string;
  plantName?: string;
  classification?: "CONFIDENTIAL" | "PROPRIETARY" | "INTERNAL USE ONLY" | "RESTRICTED";
}

export default function PrintWatermark({
  documentTitle,
  docControlNumber = "DOC-MFG-2026-V4",
  revision = "Rev 4.2",
  plantName = "Manufacturing Max Enterprise Campus",
  classification = "CONFIDENTIAL",
}: PrintWatermarkProps) {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  return (
    <div className="hidden print:block mb-6 border-b-2 border-black pb-4 text-black">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-mono font-bold tracking-widest uppercase text-gray-700">
            {plantName} â€¢ AS9100D / IATF 16949
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight mt-0.5">
            {documentTitle}
          </h1>
        </div>

        <div className="text-right font-mono text-[11px] leading-tight space-y-0.5">
          <div><span className="font-bold">DOC ID:</span> {docControlNumber}</div>
          <div><span className="font-bold">REV:</span> {revision}</div>
          <div><span className="font-bold">DATE:</span> {currentDate}</div>
          <div className="inline-block px-2 py-0.5 rounded border border-black text-[9px] font-black uppercase mt-1">
            {classification}
          </div>
        </div>
      </div>
    </div>
  );
}
