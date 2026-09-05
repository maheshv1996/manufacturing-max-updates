"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Factory,
  Wallet,
  CalendarClock,
  FileText,
  Trash2,
} from "lucide-react";

interface Asset {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  purchaseDate: string;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  method: "STRAIGHT_LINE" | "WDV";
  accumulatedDepreciation: number;
  bookValue: number;
  bookValueNow: number;
  status: "ACTIVE" | "DISPOSED";
  disposedAt: string | null;
  notes: string | null;
  nextCharge: number;
  entries: {
    id: string;
    period: string;
    amount: number;
    bookedBy: string;
    voucherId: string | null;
  }[];
}

interface Draft {
  id: string;
  voucherNumber: string;
  amount: number;
  particulars: string;
  voucherDate: string;
  sourceAssetId: string | null;
}

const CATEGORIES = [
  "MACHINERY",
  "VEHICLE",
  "FURNITURE_FIXTURES",
  "COMPUTER_EQUIPMENT",
  "EQUIPMENT",
  "BUILDING",
  "LAND",
  "OTHER",
];

export default function AssetsClient() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [byPeriod, setByPeriod] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [showDispose, setShowDispose] = useState<Asset | null>(null);
  const [disposeNote, setDisposeNote] = useState("");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [scheduleFor, setScheduleFor] = useState<Asset | null>(null);

  useEffect(() => {
    if (!showModal && !showDispose && !scheduleFor) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowModal(false);
        setShowDispose(null);
        setScheduleFor(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModal, showDispose, scheduleFor]);

  const empty = {
    assetCode: "",
    name: "",
    category: "MACHINERY",
    purchaseDate: new Date().toISOString().slice(0, 10),
    cost: "",
    salvageValue: "0",
    usefulLifeMonths: "60",
    method: "STRAIGHT_LINE",
    notes: "",
  };
  const [form, setForm] = useState(empty);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/fixed-assets");
      const data = await res.json();
      if (res.ok) {
        setAssets(data.assets || []);
        setMetrics(data.metrics);
        setByPeriod(data.byPeriod || []);
        setDrafts(data.depreciationDrafts || []);
      } else setMsg(data.error || "Load failed");
    } catch {
      setMsg("Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const save = async () => {
    setMsg("");
    if (!form.name.trim() || !form.cost || Number(form.cost) <= 0) {
      setMsg("Name and cost (>0) are required");
      return;
    }
    setBusy(true);
    try {
      const body = {
        action: editAsset ? "update" : "create",
        id: editAsset?.id,
        assetCode: form.assetCode,
        name: form.name,
        category: form.category,
        purchaseDate: form.purchaseDate,
        cost: Number(form.cost),
        salvageValue: Number(form.salvageValue || 0),
        usefulLifeMonths: Number(form.usefulLifeMonths || 60),
        method: form.method,
        notes: form.notes,
      };
      const res = await fetch("/api/fixed-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(
          editAsset
            ? `Asset updated — ${data.asset.assetCode}`
            : `Asset created — ${data.asset.assetCode}`,
        );
        setShowModal(false);
        setEditAsset(null);
        setForm(empty);
        await fetchAll();
      } else setMsg(data.error || "Save failed");
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  };

  const dispose = async () => {
    if (!disposeNote.trim()) {
      setMsg("Disposal note required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/fixed-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dispose",
          id: showDispose!.id,
          notes: disposeNote,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`${data.asset.assetCode} disposed`);
        setShowDispose(null);
        setDisposeNote("");
        await fetchAll();
      } else setMsg(data.error || "Disposal failed");
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/fixed-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-period", period }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(
          `${period}: ${data.made.length} depreciation voucher draft(s) created → check & post them in Vouchers.`,
        );
        await fetchAll();
      } else setMsg(data.error || "Generation failed");
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString();

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-emerald-300 font-semibold">{msg}</p>}

      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Assets",
              value: metrics.assetCount,
              sub: `${assets.filter((a) => a.status === "ACTIVE").length} active`,
              icon: <Factory className="h-5 w-5 text-sky-400" />,
            },
            {
              label: "Gross cost ₹",
              value: fmt(metrics.grossCost),
              icon: <Wallet className="h-5 w-5 text-blue-400" />,
            },
            {
              label: "Accumulated dep. ₹",
              value: fmt(metrics.accumulated),
              icon: <CalendarClock className="h-5 w-5 text-amber-400" />,
            },
            {
              label: "Net book value ₹",
              value: fmt(metrics.bookValue),
              icon: <Wallet className="h-5 w-5 text-emerald-400" />,
            },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4"
            >
              <div className="flex items-center gap-2">
                {k.icon}
                <p className="text-xs text-slate-400">{k.label}</p>
              </div>
              <p className="text-xl font-black text-white mt-1">{k.value}</p>
              {k.sub && <p className="text-[11px] text-slate-500">{k.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Depreciation run strip */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="font-bold text-white flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-violet-400" /> Monthly
            depreciation → voucher drafts
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Pick a month — drafts land in{" "}
            <a
              href="/finance/vouchers"
              className="text-indigo-400 hover:underline font-semibold"
            >
              Vouchers
            </a>{" "}
            as PENDING CHECK. Nothing is booked until a manager checks & posts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            onClick={generate}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-bold px-4 py-2 shadow-md transition-all disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}{" "}
            Generate Month Vouchers
          </button>
        </div>
      </div>

      {/* Pending drafts */}
      {drafts.length > 0 && (
        <div className="rounded-2xl bg-violet-950/30 border border-violet-500/30 p-5">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-300" /> {drafts.length}{" "}
            depreciation draft(s) awaiting manager check
          </h3>
          <div className="flex flex-wrap gap-2">
            {drafts.map((d) => (
              <span
                key={d.id}
                className="rounded-lg bg-slate-900/70 border border-violet-500/40 px-3 py-1.5 text-xs font-mono text-violet-200"
              >
                {d.voucherNumber} · {fmt(d.amount)} ·{" "}
                {d.particulars.split("—")[0].trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Register */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="font-bold text-white">Fixed asset register</h3>
          <button
            onClick={() => {
              setEditAsset(null);
              setForm(empty);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold px-3 py-1.5 shadow-md transition-all"
          >
            <Plus className="h-3.5 w-3.5" /> Add asset
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-700">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Asset</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Cost</th>
                <th className="py-3 px-4 text-right">Accumulated</th>
                <th className="py-3 px-4 text-right">Book value</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin inline" /> Loading…
                  </td>
                </tr>
              )}
              {!loading && assets.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    No fixed assets yet — add the first one.
                  </td>
                </tr>
              )}
              {assets.map((a) => (
                <tr
                  key={a.id}
                  className={`border-b border-slate-700/60 hover:bg-slate-700/30 transition-colors ${a.status === "DISPOSED" ? "opacity-50" : ""}`}
                >
                  <td className="py-3 px-4 font-mono font-bold text-blue-400">
                    {a.assetCode}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-bold text-white">{a.name}</p>
                    <p className="text-[10px] text-slate-500">
                      Bought {fmtDate(a.purchaseDate)} · life{" "}
                      {a.usefulLifeMonths}m
                    </p>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-400">
                    {a.category}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-200">
                    {fmt(a.cost)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-amber-300">
                    {fmt(a.accumulatedDepreciation)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-300">
                    {fmt(a.bookValueNow)}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <span
                      className={`rounded-full border px-2 py-0.5 font-bold ${a.method === "WDV" ? "border-sky-500/40 text-sky-300 bg-sky-500/10" : "border-slate-500/40 text-slate-300 bg-slate-500/10"}`}
                    >
                      {a.method}
                    </span>
                    {a.method === "STRAIGHT_LINE" &&
                      a.bookValueNow > a.salvageValue && (
                        <span className="block text-[10px] text-slate-500 mt-1">
                          next {fmt(a.nextCharge)}/mo
                        </span>
                      )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${a.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : "bg-rose-500/15 text-rose-300 border-rose-500/40"}`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1.5">
                    <button
                      onClick={() => {
                        setEditAsset(a);
                        setForm({
                          assetCode: a.assetCode,
                          name: a.name,
                          category: a.category,
                          purchaseDate: a.purchaseDate.slice(0, 10),
                          cost: String(a.cost),
                          salvageValue: String(a.salvageValue),
                          usefulLifeMonths: String(a.usefulLifeMonths),
                          method: a.method,
                          notes: a.notes || "",
                        });
                        setShowModal(true);
                      }}
                      disabled={a.status === "DISPOSED"}
                      className="px-2 py-1 bg-slate-700/60 border border-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-600 transition-colors disabled:opacity-40"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setScheduleFor(a)}
                      className="px-2 py-1 bg-sky-500/15 text-sky-300 border border-sky-500/40 rounded-lg text-[10px] font-bold hover:bg-sky-500/25 transition-colors"
                    >
                      Schedule
                    </button>
                    {a.status === "ACTIVE" && (
                      <button
                        onClick={() => {
                          setShowDispose(a);
                          setDisposeNote("");
                        }}
                        className="px-2 py-1 bg-rose-500/15 text-rose-300 border border-rose-500/40 rounded-lg text-[10px] font-bold hover:bg-rose-500/25 transition-colors"
                      >
                        Dispose
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booked depreciation by period */}
      {byPeriod.length > 0 && (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-5">
          <h3 className="font-bold text-white mb-3">
            Depreciation booked per month
          </h3>
          <div className="flex flex-wrap gap-2">
            {byPeriod.map((p) => (
              <span
                key={p.period}
                className="rounded-lg bg-slate-900/70 border border-slate-600 px-3 py-1.5 text-xs font-mono"
              >
                {p.label}:{" "}
                <span className="text-amber-300 font-bold">
                  {fmt(p.amount)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add / edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-white">
              {editAsset ? `Edit ${editAsset.assetCode}` : "Add fixed asset"}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  Name *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. CNC VMC 850"
                  className="mt-1 w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="mt-1 w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  Purchase date *
                </label>
                <input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) =>
                    setForm({ ...form, purchaseDate: e.target.value })
                  }
                  className="mt-1 w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  Cost (₹) *
                </label>
                <input
                  type="number"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  className="mt-1 w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  Salvage (₹)
                </label>
                <input
                  type="number"
                  value={form.salvageValue}
                  onChange={(e) =>
                    setForm({ ...form, salvageValue: e.target.value })
                  }
                  className="mt-1 w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  Life (months)
                </label>
                <input
                  type="number"
                  value={form.usefulLifeMonths}
                  onChange={(e) =>
                    setForm({ ...form, usefulLifeMonths: e.target.value })
                  }
                  className="mt-1 w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  Method
                </label>
                <select
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                  className="mt-1 w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="STRAIGHT_LINE">Straight line</option>
                  <option value="WDV">WDV (declining)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold">
                  Code (auto if blank)
                </label>
                <input
                  value={form.assetCode}
                  onChange={(e) =>
                    setForm({ ...form, assetCode: e.target.value })
                  }
                  className="mt-1 w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                Notes
              </label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1 w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-bold text-slate-400 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}{" "}
                {editAsset ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispose modal */}
      {showDispose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowDispose(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dispose-modal-title"
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="dispose-modal-title" className="font-bold text-white flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-rose-400" /> Dispose{" "}
              {showDispose.assetCode} — {showDispose.name}
            </h3>
            <p className="text-xs text-slate-400">
              Book value {fmt(showDispose.bookValueNow)} ·{" "}
              {showDispose.entries.length} entry(ies) booked. Disposal is
              audited and stops future depreciation drafts.
            </p>
            <textarea
              value={disposeNote}
              onChange={(e) => setDisposeNote(e.target.value)}
              placeholder="Disposal note * (e.g. sold to scrap dealer, invoice #…)"
              className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm h-20 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDispose(null)}
                className="px-4 py-2 text-sm font-bold text-slate-400 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={dispose}
                disabled={busy || !disposeNote.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-sm transition-all"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                ) : null}{" "}
                Confirm disposal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule modal */}
      {scheduleFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setScheduleFor(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-modal-title"
            className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="schedule-modal-title" className="font-bold text-white mb-1">
              {scheduleFor.assetCode} — {scheduleFor.name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Cost {fmt(scheduleFor.cost)} · salvage{" "}
              {fmt(scheduleFor.salvageValue)} · {scheduleFor.method} ·{" "}
              {scheduleFor.usefulLifeMonths} months · booked{" "}
              {scheduleFor.entries.length} month(s)
            </p>
            {scheduleFor.entries.length === 0 ? (
              <p className="text-sm text-slate-500">
                No entries booked yet — generate a month from the strip above
                and post the drafts.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-slate-500 border-b border-slate-700">
                    <th className="py-2">Period</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2">Booked by</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleFor.entries.map((e) => (
                    <tr key={e.id} className="border-b border-slate-700/50">
                      <td className="py-2 font-mono text-slate-300">
                        {e.period}
                      </td>
                      <td className="py-2 text-right font-mono text-amber-300">
                        {fmt(e.amount)}
                      </td>
                      <td className="py-2 text-xs text-slate-500">
                        {e.bookedBy}
                        {e.voucherId ? "" : " (?)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setScheduleFor(null)}
                className="px-4 py-2 text-sm font-bold text-slate-400 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
