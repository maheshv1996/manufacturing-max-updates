import Link from "next/link";
import { ArrowLeft, Home, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0b0c0e] text-[#f9fafb] flex flex-col items-center justify-center p-6 select-none">
      <div className="w-full max-w-md bg-[#141519] border border-white/10 rounded-2xl p-8 text-center shadow-2xl space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
          <Compass className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">404</h1>
          <h2 className="text-lg font-semibold text-slate-200">
            Page Not Found
          </h2>
          <p className="text-sm text-slate-400">
            The page or department sub-function you requested could not be
            located.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/20 transition-colors"
          >
            <Home className="w-4 h-4" />
            Home Gateway
          </Link>
          <Link
            href="/command"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold border border-white/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Command Center
          </Link>
        </div>
      </div>
    </div>
  );
}
