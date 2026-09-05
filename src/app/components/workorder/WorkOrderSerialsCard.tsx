"use client";

import { useState, useEffect } from "react";
import {
  Layers,
  Search,
  ChevronRight,
  Activity,
  AlertTriangle,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function WorkOrderSerialsCard({ wo }: { wo: any }) {
  const [search, setSearch] = useState("");
  const [selectedSerial, setSelectedSerial] = useState<any | null>(null);

  useEffect(() => {
    if (!selectedSerial) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedSerial(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSerial]);

  if (wo.trackingMode !== "SERIAL") return null;

  const serials = wo.serialUnits || [];

  const filteredSerials = serials.filter((s: any) =>
    s.serialNo.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/50 rounded-lg">
              <Layers className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Serialization & Genealogy
              </h2>
              <p className="text-sm text-slate-400">
                Track individual unit history
              </p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search serials..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSerials.map((s: any) => (
            <button
              key={s.id}
              onClick={() => setSelectedSerial(s)}
              className="flex items-center justify-between p-4 bg-slate-50 hover:bg-indigo-50/50 bg-slate-800/60 hover:bg-indigo-900/20 border border-slate-600 hover:border-indigo-300 hover:border-indigo-700 rounded-xl transition-all group text-left"
            >
              <div>
                <div className="font-mono font-bold text-white text-lg">
                  {s.serialNo}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`inline-flex px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                      s.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 text-emerald-400"
                        : s.status === "QUARANTINED"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 text-rose-400"
                          : s.status === "SHIPPED"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 text-blue-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 text-amber-400"
                    }`}
                  >
                    {s.status}
                  </span>
                  <span className="text-xs text-slate-400">
                    {s.events?.length || 0} events
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            </button>
          ))}
          {filteredSerials.length === 0 && (
            <div className="col-span-full py-8 text-center text-sm text-slate-400">
              No serials found matching your search.
            </div>
          )}
        </div>
      </section>

      {/* Genealogy Drawer */}
      {selectedSerial && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unit-passport-title"
          className="fixed inset-0 z-50 flex justify-end"
        >
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setSelectedSerial(null)}
          />
          <div className="relative w-full max-w-md bg-slate-800/60 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-700">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-800/60">
              <div>
                <h3
                  id="unit-passport-title"
                  className="text-xl font-bold text-white flex items-center gap-2"
                >
                  <ShieldCheck className="w-5 h-5 text-indigo-500" />
                  Unit Passport
                </h3>
                <div className="font-mono text-sm text-indigo-400 font-bold mt-1">
                  {selectedSerial.serialNo}
                </div>
              </div>
              <button
                type="button"
                aria-label="Close unit passport drawer"
                onClick={() => setSelectedSerial(null)}
                className="p-2 hover:bg-slate-200 hover:bg-slate-800/90 rounded-full text-slate-500 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Genealogy Timeline
              </h4>

              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-700 before:to-transparent">
                {selectedSerial.events?.map((ev: any, _idx: number) => (
                  <div
                    key={ev.id}
                    className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white border-slate-900 bg-indigo-100 dark:bg-indigo-900 text-indigo-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                      {ev.type === "OPERATION_COMPLETE" ? (
                        <Activity className="w-4 h-4" />
                      ) : ev.type === "INSPECTION" ? (
                        <ShieldCheck className="w-4 h-4" />
                      ) : ev.type === "NCR" ? (
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>

                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-600 bg-slate-800/60 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-700/40 text-slate-300">
                          {ev.type}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatDistanceToNow(new Date(ev.at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-200 mt-2">
                        {ev.description}
                      </p>
                      <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full bg-slate-700/40 flex items-center justify-center text-[8px] font-bold">
                          {ev.actorName.charAt(0)}
                        </div>
                        {ev.actorName}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-700 bg-slate-800/60">
              <a
                href={`/reports/serial/${selectedSerial.id}`}
                target="_blank"
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-sm"
              >
                View Printable Passport
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
