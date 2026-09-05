"use client";

import PageHeader from "@/app/components/shared/PageHeader";

import {useCallback, useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ClipboardX,
  Info,
  ShieldCheck
} from "lucide-react";
import { Button, Input } from "@/app/components/ui";

export default function IqcClient() {
  const [grns, setGrns] = useState<any[]>([]);
  const [aqlPlans, setAqlPlans] = useState<any[]>([]);
  const [, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [planForm, setPlanForm] = useState<any>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/grn", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setGrns(data.grns || []);
        setAqlPlans(data.aqlPlans || []);
        setSuppliers(data.suppliers || []);
      }
    } catch {
      setMsg("Failed to load IQC data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editing) {
        setEditing(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editing]);

  const inspect = async (grn: any, decision: "PASSED" | "REJECTED") => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/grn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "inspect",
          data: {
            id: grn.id,
            inspectionStatus: decision,
            notes:
              decision === "REJECTED"
                ? "AQL rejection — lot HELD, supplier NCR drafted"
                : undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Inspection failed");
        return;
      }
      await load();
      setMsg(
        decision === "REJECTED"
          ? `Lot HELD — supplier NCR drafted for GRN ${grn.grnNumber}`
          : `GRN ${grn.grnNumber} passed incoming inspection`,
      );
    } catch {
      setMsg("Inspection failed");
    } finally {
      setBusy(false);
    }
  };

  const savePlan = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/grn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "aql-plan", data: planForm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Save failed");
        return;
      }
      setEditing(null);
      setPlanForm({});
      await load();
      setMsg("AQL plan saved");
    } catch {
      setMsg("Save failed");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setPlanForm(p);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Iqc"
        description="Inspections, NCRs, audits and compliance control."
        icon={<ShieldCheck className="w-6 h-6" />}
        iconTone="emerald"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["pending", "Pending inspection", "text-amber-300"],
          ["rejected", "Rejected / HELD", "text-rose-300"],
          ["passed", "Passed", "text-emerald-300"],
          ["ncr", "Supplier NCRs auto", "text-orange-300"],
        ].map(([k, label, cls]) => (
          <div
            key={k}
            className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4"
          >
            <div className="text-xs text-slate-400">{label}</div>
            <div className={`text-2xl font-black mt-1 ${cls}`}>
              {k === "pending"
                ? grns.filter((g) => g.inspectionStatus === "PENDING").length
                : k === "rejected"
                  ? grns.filter(
                      (g) =>
                        g.inspectionStatus === "REJECTED" ||
                        g.inspectionStatus === "HELD" ||
                        g.lotHeld,
                    ).length
                  : k === "passed"
                    ? grns.filter((g) => g.inspectionStatus === "PASSED").length
                    : grns.filter((g) => g.ncrId).length}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-bold text-white">
              AQL Sampling Plans — per material class
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditing({});
              setPlanForm({
                materialClass: "C",
                aqlLevel: "II",
                sampleSize: 5,
                acceptanceNumber: 0,
                rejectionNumber: 1,
              });
            }}
          >
            New plan
          </Button>
        </div>
        <div className="divide-y divide-slate-700/40">
          {aqlPlans.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm">
              No AQL plans yet — create class A/B/C sampling tables.
            </div>
          ) : (
            aqlPlans.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-700/20 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="font-black text-white">
                    {p.materialClass}
                  </span>
                  <span className="text-slate-400">AQL {p.aqlLevel}</span>
                  <span className="text-slate-400">
                    sample {p.sampleSize} pcs
                  </span>
                  <span className="text-slate-400">
                    Ac {p.acceptanceNumber} / Re {p.rejectionNumber}
                  </span>
                  {p.description && (
                    <span className="text-xs text-slate-500">
                      {p.description}
                    </span>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                  Edit
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="iqc-aql-title"
            className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="iqc-aql-title" className="font-bold text-white">
              {editing.id
                ? `Edit AQL plan — class ${editing.materialClass}`
                : "New AQL plan"}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Material class</label>
                <select
                  value={planForm.materialClass}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, materialClass: e.target.value })
                  }
                  className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                >
                  {["A", "B", "C"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">AQL level</label>
                <Input
                  value={planForm.aqlLevel || "II"}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, aqlLevel: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">
                  Sample size (pcs)
                </label>
                <Input
                  type="number"
                  value={planForm.sampleSize ?? ""}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      sampleSize: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Ac — accept ≤</label>
                <Input
                  type="number"
                  value={planForm.acceptanceNumber ?? ""}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      acceptanceNumber: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Re — reject ≥</label>
                <Input
                  type="number"
                  value={planForm.rejectionNumber ?? ""}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      rejectionNumber: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400">Description</label>
                <Input
                  value={planForm.description || ""}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, description: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={savePlan} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save plan"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-slate-700">
          <ClipboardX className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-bold text-white">
            Incoming Inspection Queue
          </span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading…
          </div>
        ) : (
          <div className="divide-y divide-slate-700/40">
            {grns.filter((g) => g.inspectionStatus === "PENDING" || g.lotHeld)
              .length === 0 && (
              <div className="p-6 text-center text-slate-400 text-sm">
                No lots awaiting inspection.
              </div>
            )}
            {grns
              .filter((g) => g.inspectionStatus === "PENDING" || g.lotHeld)
              .map((g) => (
                <div
                  key={g.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-700/20"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">
                        {g.grnNumber}
                      </span>
                      <span className="text-xs text-slate-500">
                        {g.supplier?.name}
                      </span>
                      {g.lotHeld && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white">
                          LOT HELD
                        </span>
                      )}
                      {g.ncrId && (
                        <a
                          href="/mrb"
                          className="text-[10px] font-black px-1.5 py-0.5 rounded bg-orange-600 text-white hover:bg-orange-500"
                        >
                          NCR →
                        </a>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {g.rawMaterial?.sku} · {g.rawMaterial?.name} · qty{" "}
                      {g.receivedQty} · batch {g.batchNo || "—"} · class{" "}
                      {g.rawMaterial?.materialClass || "C"}
                      {g.aqlSampleSize
                        ? ` · sample ${g.aqlSampleSize} pcs`
                        : g.inspectionStatus === "PENDING" && (
                            <Info className="inline h-3 w-3 ml-1 text-slate-600" />
                          )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => inspect(g, "PASSED")}
                      disabled={busy}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Pass
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => inspect(g, "REJECTED")}
                      disabled={busy}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
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
