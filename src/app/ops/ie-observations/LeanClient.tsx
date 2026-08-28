"use client";

import { useCallback, useEffect, useState } from "react";
import { Timer, Loader2, Plus, CheckCircle2 } from "lucide-react";
import { Button, Input, Select } from "@/app/components/ui";

interface Observation {
  id: string;
  title: string;
  area: string;
  category: string;
  description: string | null;
  estMinutesSaved: number;
  status: string;
  observedBy: string;
  observedAt: string;
  implementedBy?: string | null;
}

const CATEGORY_META: Record<string, { label: string; cls: string }> = {
  MOTION: {
    label: "Motion",
    cls: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  },
  WAIT: {
    label: "Waiting",
    cls: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  },
  OVERPROCESS: {
    label: "Over-processing",
    cls: "bg-violet-500/15 text-violet-300 border-violet-500/40",
  },
  INVENTORY: {
    label: "Inventory",
    cls: "bg-teal-500/15 text-teal-300 border-teal-500/40",
  },
  DEFECT: {
    label: "Defects",
    cls: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  },
  TRANSPORT: {
    label: "Transport",
    cls: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  },
  OVERPRODUCTION: {
    label: "Over-production",
    cls: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40",
  },
};

export default function LeanClient() {
  const [obs, setObs] = useState<Observation[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    area: "",
    category: "MOTION",
    description: "",
    estMinutesSaved: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/lean-observations", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setObs(data.observations || []);
        setStats(data.stats || {});
      }
    } catch {
      setMsg("Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!form.title.trim() || !form.area.trim() || !form.estMinutesSaved) {
      setMsg("Title, area and est. minutes required");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/lean-observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          ...form,
          estMinutesSaved: Number(form.estMinutesSaved),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Create failed");
        return;
      }
      setShowCreate(false);
      setForm({
        title: "",
        area: "",
        category: "MOTION",
        description: "",
        estMinutesSaved: "",
      });
      await load();
    } catch {
      setMsg("Create failed");
    } finally {
      setBusy(false);
    }
  };

  const implement = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/lean-observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "implement", id }),
      });
      if (!res.ok) {
        const d = await res.json();
        setMsg(d.error || "Failed");
      }
      await load();
    } catch {
      setMsg("Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">Total observations</div>
          <div className="text-2xl font-black text-white mt-1">
            {stats.total ?? 0}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">Implemented</div>
          <div className="text-2xl font-black text-emerald-300 mt-1">
            {stats.implemented ?? 0}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">Est. saved · this month</div>
          <div className="text-2xl font-black text-cyan-300 mt-1">
            {stats.monthMinutes ?? 0}m
          </div>
        </div>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4">
          <div className="text-xs text-slate-400">= hours / month</div>
          <div className="text-2xl font-black text-white mt-1">
            {stats.monthHours ?? 0}h
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-cyan-500" />
            <span className="text-sm font-bold text-white">
              Observation Log
            </span>
          </div>
          <Button onClick={() => setShowCreate((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" /> Log Observation
          </Button>
        </div>

        {showCreate && (
          <div className="p-4 border-b border-slate-700 space-y-3 bg-slate-900/40">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-slate-400">
                  Observation title *
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Operator walks 40m per cycle to fetch castings"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Area *</label>
                <Input
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                  placeholder="e.g. CNC bay 2"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">
                  Waste category *
                </label>
                <Select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  {Object.entries(CATEGORY_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-400">
                  Est. minutes saved / cycle *
                </label>
                <Input
                  type="number"
                  min="0"
                  value={form.estMinutesSaved}
                  onChange={(e) =>
                    setForm({ ...form, estMinutesSaved: e.target.value })
                  }
                  placeholder="e.g. 3"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Description</label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Before / after suggestion…"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={create} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Log Observation"
                )}
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading…
          </div>
        ) : obs.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            No observations yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-700/40">
            {obs.map((o) => {
              const cm = CATEGORY_META[o.category] || CATEGORY_META.MOTION;
              return (
                <div
                  key={o.id}
                  className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-700/20"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cm.cls}`}
                      >
                        {cm.label}
                      </span>
                      <span className="font-medium text-white">{o.title}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {o.area} · {o.observedBy} ·{" "}
                      {new Date(o.observedAt).toLocaleDateString()}
                    </div>
                    {o.description && (
                      <p className="text-xs text-slate-400 mt-1">
                        {o.description}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-sm font-black text-cyan-300">
                      {o.estMinutesSaved}m
                    </span>
                    {o.status === "IMPLEMENTED" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                        <CheckCircle2 className="h-3 w-3" /> DONE
                        {`${o.implementedBy ? " · " + o.implementedBy : ""}`}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => implement(o.id)}
                        disabled={busy}
                      >
                        Mark done
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {msg && (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          {msg}
        </div>
      )}
    </div>
  );
}
