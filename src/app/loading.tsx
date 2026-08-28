import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-semibold text-text-1 animate-pulse">
          Loading Workspace...
        </h3>
        <p className="text-sm text-text-3">Fetching real-time data</p>
      </div>

      {/* Skeleton placeholders */}
      <div className="w-full max-w-4xl space-y-4 mt-8 opacity-50">
        <div className="h-24 bg-surface-2 rounded-xl animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-32 bg-surface-2 rounded-xl animate-pulse delay-75"></div>
          <div className="h-32 bg-surface-2 rounded-xl animate-pulse delay-100"></div>
          <div className="h-32 bg-surface-2 rounded-xl animate-pulse delay-150"></div>
        </div>
        <div className="h-64 bg-surface-2 rounded-xl animate-pulse delay-200"></div>
      </div>
    </div>
  );
}
