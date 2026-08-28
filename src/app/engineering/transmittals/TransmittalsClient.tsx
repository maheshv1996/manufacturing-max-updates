"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  X,
  FileSignature,
  Send,
  CheckCircle2,
  Clock,
} from "lucide-react";

export default function TransmittalsClient() {
  const [transmittals, setTransmittals] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [r, me] = await Promise.all([
        fetch("/api/drawing-transmittal"),
        fetch("/api/auth/me"),
      ]);
      if (r.ok) {
        const d = await r.json();
        setTransmittals(d.transmittals || []);
        setDocuments(d.documents || []);
      }
      if (me.ok) {
        const m = await me.json();
        setIsManager(m.user?.level === "MANAGER" || m.user?.isOwner === true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const api = async (body: any): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch("/api/drawing-transmittal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        setToast(d.error || "Action failed");
        return false;
      }
      setToast("Saved");
      await fetchData();
      return true;
    } catch {
      setToast("Network error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const release = async (docId: string, title: string) => {
    const reason = window.prompt(
      `Release rev for acknowledgement: "${title.slice(0, 50)}…" — this requires Production + Quality manager acknowledgement.`,
    );
    if (reason === null) return;
    await api({ action: "release", data: { documentId: docId, reason } });
  };

  const ack = async (transmittalId: string, role: string, title: string) => {
    const reason = window.prompt(
      `Acknowledge as ${role} manager: "${title.slice(0, 50)}…"`,
    );
    if (reason === null) return;
    await api({ action: "ack", data: { transmittalId, role, reason } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  const releasedIds = new Set(transmittals.map((t) => t.documentId));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-300 font-semibold">
            <FileSignature className="w-4 h-4" /> Drawing Revision Control
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Drawing Transmittal
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Releasing a revision requires acknowledgement from Production &amp;
            Quality managers — until then the shop floor sees a stale-rev flag.
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <div className="text-2xl font-bold text-white">
            {transmittals.length}
          </div>
          <div className="text-xs text-slate-400 mt-1">Transmittals</div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <div className="text-2xl font-bold text-amber-300">
            {
              transmittals.filter((t) => !(t.ackProduction && t.ackQuality))
                .length
            }
          </div>
          <div className="text-xs text-slate-400 mt-1">Awaiting ack</div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 p-4">
          <div className="text-2xl font-bold text-emerald-300">
            {transmittals.filter((t) => t.ackProduction && t.ackQuality).length}
          </div>
          <div className="text-xs text-slate-400 mt-1">Fully acknowledged</div>
        </div>
      </div>

      {/* Transmittals */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/60 text-xs uppercase tracking-wider text-slate-400 font-semibold">
          Transmittals
        </div>
        <div className="divide-y divide-slate-800/60">
          {transmittals.map((t) => {
            const doc = t.document;
            const full = t.ackProduction && t.ackQuality;
            return (
              <div key={t.id} className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {doc.title}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/40 border border-slate-600/40 text-slate-300">
                        REV {t.revision}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border ${full ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40" : "bg-amber-500/10 text-amber-300 border-amber-500/40"}`}
                      >
                        {full ? "ACKNOWLEDGED" : "AWAITING ACK"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {doc.product?.sku}{" "}
                      {doc.operation ? `· ${doc.operation.code}` : ""} ·
                      released {new Date(t.releasedAt).toLocaleDateString()} by{" "}
                      {t.releasedBy}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!t.ackProduction && isManager && (
                      <button
                        onClick={() => ack(t.id, "PRODUCTION", doc.title)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/10 border border-sky-500/40 px-2.5 py-1.5 text-xs text-sky-300 hover:bg-sky-500/20 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ack as
                        Production
                      </button>
                    )}
                    {!t.ackQuality && isManager && (
                      <button
                        onClick={() => ack(t.id, "QUALITY", doc.title)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500/10 border border-violet-500/40 px-2.5 py-1.5 text-xs text-violet-300 hover:bg-violet-500/20 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ack as Quality
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${t.ackProduction ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40" : "bg-slate-700/30 text-slate-400 border border-slate-600/40"}`}
                  >
                    {t.ackProduction ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    Production{" "}
                    {t.ackProduction ? `· ${t.ackProductionBy}` : "pending"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${t.ackQuality ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40" : "bg-slate-700/30 text-slate-400 border border-slate-600/40"}`}
                  >
                    {t.ackQuality ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    Quality {t.ackQuality ? `· ${t.ackQualityBy}` : "pending"}
                  </span>
                </div>
              </div>
            );
          })}
          {transmittals.length === 0 && (
            <div className="p-10 text-center text-slate-500 text-sm">
              No revisions released yet. Release one below.
            </div>
          )}
        </div>
      </div>

      {/* Current documents — release surface */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/60 text-xs uppercase tracking-wider text-slate-400 font-semibold">
          Current documents — release a revision
        </div>
        <div className="divide-y divide-slate-800/60">
          {documents.map((d) => (
            <div
              key={d.id}
              className="p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-sm text-slate-200">
                  {d.title}{" "}
                  <span className="text-slate-500">REV {d.version}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {d.product?.sku} {d.operation ? `· ${d.operation.code}` : ""}
                </div>
              </div>
              {releasedIds.has(d.id) ? (
                <span className="text-xs text-slate-500 shrink-0">
                  Already transmitted
                </span>
              ) : (
                isManager && (
                  <button
                    onClick={() => release(d.id, d.title)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/40 px-3 py-1.5 text-xs text-indigo-300 hover:bg-indigo-500/20 transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" /> Release Rev
                  </button>
                )
              )}
            </div>
          ))}
          {documents.length === 0 && (
            <div className="p-10 text-center text-slate-500 text-sm">
              No current documents.
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-800 border border-slate-600/60 px-4 py-3 text-sm text-white shadow-xl">
          {toast}
          <button
            onClick={() => setToast(null)}
            className="ml-3 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5 inline" />
          </button>
        </div>
      )}
    </div>
  );
}
