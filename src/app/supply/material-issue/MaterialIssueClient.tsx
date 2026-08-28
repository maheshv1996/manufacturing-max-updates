"use client";

import { useCallback, useEffect, useState } from "react";
import { PackageOpen, PackageCheck, AlertTriangle } from "lucide-react";
import { Button, Input } from "@/app/components/ui";

interface Slip {
  id: string;
  issueNumber: string;
  qty: number;
  batchNo: string | null;
  heatNo: string | null;
  issuedBy: string;
  issuedTo: string | null;
  issuedAt: string;
  reference: string | null;
  rawMaterial: { sku: string; name: string; unit: string };
  workOrder: { woNumber: string } | null;
}
interface ReadinessRow {
  rawMaterialId: string;
  sku: string;
  name: string;
  unit: string;
  required: number;
  issued: number;
  stock: number;
  shortBy: number;
  ready: boolean;
}
interface Readiness {
  id: string;
  woNumber: string;
  status: string;
  product: string;
  rows: ReadinessRow[];
  readyAll: boolean;
}

export default function MaterialIssueClient() {
  const [slips, setSlips] = useState<Slip[]>([]);
  const [readiness, setReadiness] = useState<Readiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [issueFor, setIssueFor] = useState<Record<string, string>>({});
  const [batchFor, setBatchFor] = useState<Record<string, string>>({});
  const [heatFor, setHeatFor] = useState<Record<string, string>>({});
  const [toFor, setToFor] = useState<Record<string, string>>({});

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/material-issue");
      const data = await res.json();
      setSlips(data.slips || []);
      setReadiness(data.readiness || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const issue = async (woId: string, rmId: string) => {
    const qty = issueFor[`${woId}:${rmId}`];
    if (!qty || Number(qty) <= 0) {
      setMsg("Enter a quantity first.");
      return;
    }
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/material-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId: woId,
          rawMaterialId: rmId,
          qty: Number(qty),
          batchNo: batchFor[`${woId}:${rmId}`] || undefined,
          heatNo: heatFor[`${woId}:${rmId}`] || undefined,
          issuedTo: toFor[`${woId}:${rmId}`] || undefined,
        }),
      });
      const data = await res.json();
      setMsg(
        res.ok
          ? `Issued ${data.slip?.issueNumber} — consumption posted.`
          : data.error || "Issue failed",
      );
      if (res.ok) await fetchAll();
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  };

  const readyCount = readiness.filter((r) => r.readyAll).length;
  const shortCount = readiness.filter((r) => !r.readyAll).length;

  return (
    <div className="space-y-6">
      {msg && (
        <p
          className={`text-sm font-semibold ${msg.startsWith("Issued") ? "text-emerald-300" : "text-rose-300"}`}
        >
          {msg}
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Open work orders",
            value: readiness.length,
            icon: <PackageOpen className="h-5 w-5 text-sky-500" />,
          },
          {
            label: "Material-ready",
            value: readyCount,
            icon: <PackageCheck className="h-5 w-5 text-emerald-500" />,
          },
          {
            label: "Short on RM",
            value: shortCount,
            icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
            tone: shortCount ? "text-amber-500" : undefined,
          },
          {
            label: "Slips issued",
            value: slips.length,
            icon: <PackageOpen className="h-5 w-5 text-indigo-500" />,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 flex items-center gap-3"
          >
            {k.icon}
            <div>
              <p className={`text-2xl font-black text-white ${k.tone || ""}`}>
                {k.value}
              </p>
              <p className="text-xs text-slate-400">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <PackageOpen className="h-5 w-5 text-sky-400" /> WO Material Readiness
          & Issue
        </h3>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : readiness.length === 0 ? (
          <p className="text-sm text-slate-400 rounded-2xl bg-slate-800/40 border border-slate-800 p-4">
            No planned/in-progress work orders.
          </p>
        ) : (
          readiness.map((wo) => (
            <details
              key={wo.id}
              className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4"
              open={!wo.readyAll}
            >
              <summary className="cursor-pointer flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white">{wo.woNumber}</span>
                  <span className="text-sm text-slate-300">{wo.product}</span>
                  <span className="text-xs text-slate-400">{wo.status}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full border text-xs font-bold ${wo.readyAll ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : "bg-amber-500/15 text-amber-300 border-amber-500/40"}`}
                >
                  {wo.readyAll ? "READY" : "RM SHORT"}
                </span>
              </summary>
              <div className="mt-3 space-y-2">
                {wo.rows.map((r) => (
                  <div
                    key={r.rawMaterialId}
                    className="rounded-xl bg-slate-900/60 border border-slate-800 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-sm text-white font-medium">
                          {r.name}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          {r.sku} · required {Math.round(r.required)} · issued{" "}
                          {Math.round(r.issued)} · stock {Math.round(r.stock)}{" "}
                          {r.unit}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full border ${r.ready ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : "bg-amber-500/15 text-amber-300 border-amber-500/40"}`}
                      >
                        {r.ready
                          ? "COVERED"
                          : `SHORT ${Math.round(r.shortBy)} ${r.unit}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        type="number"
                        placeholder="Qty to issue"
                        value={issueFor[`${wo.id}:${r.rawMaterialId}`] || ""}
                        onChange={(e) =>
                          setIssueFor((m) => ({
                            ...m,
                            [`${wo.id}:${r.rawMaterialId}`]: e.target.value,
                          }))
                        }
                        className="w-28"
                      />
                      <Input
                        placeholder="Batch no."
                        value={batchFor[`${wo.id}:${r.rawMaterialId}`] || ""}
                        onChange={(e) =>
                          setBatchFor((m) => ({
                            ...m,
                            [`${wo.id}:${r.rawMaterialId}`]: e.target.value,
                          }))
                        }
                        className="w-32"
                      />
                      <Input
                        placeholder="Heat no."
                        value={heatFor[`${wo.id}:${r.rawMaterialId}`] || ""}
                        onChange={(e) =>
                          setHeatFor((m) => ({
                            ...m,
                            [`${wo.id}:${r.rawMaterialId}`]: e.target.value,
                          }))
                        }
                        className="w-28"
                      />
                      <Input
                        placeholder="Issued to"
                        value={toFor[`${wo.id}:${r.rawMaterialId}`] || ""}
                        onChange={(e) =>
                          setToFor((m) => ({
                            ...m,
                            [`${wo.id}:${r.rawMaterialId}`]: e.target.value,
                          }))
                        }
                        className="w-32"
                      />
                      <Button
                        onClick={() => issue(wo.id, r.rawMaterialId)}
                        disabled={busy}
                        size="sm"
                      >
                        <PackageOpen className="w-4 h-4" /> Issue
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-bold text-white">Recent Issue Slips</h3>
        {slips.length === 0 ? (
          <p className="text-sm text-slate-400 rounded-2xl bg-slate-800/40 border border-slate-800 p-4">
            No issues yet.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {slips.slice(0, 12).map((s) => (
              <div
                key={s.id}
                className="rounded-xl bg-slate-800/60 border border-slate-700 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">
                    {s.issueNumber}
                  </p>
                  <span className="text-xs text-slate-400">
                    {new Date(s.issuedAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  {s.rawMaterial.name} × {s.qty} {s.rawMaterial.unit} →{" "}
                  {s.workOrder?.woNumber || s.reference}
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  {s.batchNo ? `batch ${s.batchNo}` : ""}
                  {s.heatNo ? ` · heat ${s.heatNo}` : ""} · by {s.issuedBy}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
