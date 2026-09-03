"use client";


import { logClientError } from "@/lib/clientLogger";
import React, { useEffect, useState } from "react";
import { Printer, ArrowLeft, Factory } from "lucide-react";
import Link from "next/link";

interface PrintWrapperProps {
  title: string;
  subtitle?: string;
  controls?: React.ReactNode;
  children: React.ReactNode;
  landscape?: boolean;
}

export default function PrintWrapper({
  title,
  subtitle,
  controls,
  children,
  landscape = false,
}: PrintWrapperProps) {
  const [branding, setBranding] = useState({
    appName: "Manufacturing Max",
    tagline: "Enterprise Manufacturing Suite",
    logoUrl: "",
  });
  const [generatedAt, setGeneratedAt] = useState<string>("");

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString());

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.branding) {
          setBranding({
            appName: data.branding.appName || "Manufacturing Max",
            tagline: data.branding.tagline || "OEE & Downtime Tracking",
            logoUrl: data.branding.logoUrl || "",
          });
        }
      })
      .catch((err) => logClientError(err, "PrintWrapper"));
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8 print:p-0 print:bg-white print:text-black">
      {/* PRINT MEDIA STYLE SHEET INJECTION */}
      <style jsx global>{`
        @media print {
          @page {
            size: ${landscape ? "landscape" : "portrait"};
            margin: 12mm;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          table {
            page-break-inside: avoid;
          }
          .page-break-before {
            page-break-before: always;
          }
        }
      `}</style>

      {/* TOP CONTROLS & NAVIGATION BAR (NO-PRINT) */}
      <div className="max-w-6xl mx-auto mb-6 no-print flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/60 p-4 rounded-2xl border border-slate-700 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="p-2 text-slate-400 hover:text-slate-900 hover:text-white bg-slate-800/60 hover:bg-slate-200 hover:bg-slate-700 rounded-xl transition-all"
            title="Back to Reports Hub"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-black text-white">{title}</h1>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          {controls}

          <button
            onClick={() => window.print()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* PRINTABLE DOCUMENT SHEET CONTAINER */}
      <div className="max-w-6xl mx-auto bg-white text-slate-900 p-8 sm:p-10 rounded-2xl border border-slate-200 shadow-xl print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none space-y-8">
        {/* BRANDING HEADER */}
        <header className="flex items-center justify-between border-b-2 border-slate-900 pb-6">
          <div className="flex items-center gap-4">
            {branding.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={branding.logoUrl}
                alt={branding.appName}
                className="h-12 w-auto object-contain"
              />
            ) : (
              <div className="p-3 bg-slate-900 text-white rounded-xl">
                <Factory className="w-7 h-7" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                {branding.appName}
              </h2>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                {branding.tagline}
              </p>
            </div>
          </div>

          <div className="text-right">
            <h3 className="text-xl font-black uppercase tracking-wide text-slate-900">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs font-medium text-slate-600">{subtitle}</p>
            )}
          </div>
        </header>

        {/* DOCUMENT BODY */}
        <main className="space-y-6">{children}</main>

        {/* PRINT FOOTER */}
        <footer className="border-t border-slate-300 pt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-slate-500 font-medium">
          <div>Generated at: {generatedAt || "N/A"}</div>
          <div>Official Plant Document • Confidential</div>
          <div>{branding.appName} MES</div>
        </footer>
      </div>
    </div>
  );
}
