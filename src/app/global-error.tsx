"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0b0c0e] text-[#f9fafb] min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            System Workspace Interrupted
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            A layout rendering conflict occurred. Reloading will restore your workspace state.
          </p>
          {error?.message && (
            <div className="mb-6 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-400 text-left overflow-x-auto max-h-32">
              {error.message}
            </div>
          )}
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Workspace
          </button>
        </div>
      </body>
    </html>
  );
}
