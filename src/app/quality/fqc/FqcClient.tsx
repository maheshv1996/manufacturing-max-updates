"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  Truck,
  PackageCheck,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/app/components/ui";

export default function FqcClient() {
  const [wos, setWos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/fqc", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setWos(data.dispatchableWos || []);
      }
    } catch {
      setMsg("Failed to load FQC board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openFor = (w: any) => {
    setOpen(w.id);
    setForm({
      finalInspectionPassed: !!w.checklist?.finalInspectionPassed,
      packingDone: !!w.checklist?.packingDone,
      docPackDone: !!w.checklist?.docPackDone,
      notes: w.checklist?.notes || "",
    });
  };

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/fqc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workOrderId: open, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Save failed");
        return;
      }
      setOpen(null);
      await load();
      setMsg(
        data.complete
          ? "Checklist complete — dispatch unlocked"
          : "Checklist saved (incomplete — dispatch stays blocked)",
      );
    } catch {
      setMsg("Save failed");
    } finally {
      setBusy(false);
    }
  };

  const allChecked =
    form.finalInspectionPassed && form.packingDone && form.docPackDone;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          ["complete", "Checklists complete", "text-emerald-300"],
          ["incomplete", "Incomplete / unstarted", "text-amber-300"],
          ["ready", "Dispatch-ready WOs", "text-sky-300"],
        ].map(([k, label, cls]) => (
          <div
            key={k}
            className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4"
          >
            <div className="text-xs text-slate-400">{label}</div>
            <div className={`text-2xl font-black mt-1 ${cls}`}>
              {k === "complete"
                ? wos.filter(
                    (w) =>
                      w.checklist?.finalInspectionPassed &&
                      w.checklist?.packingDone &&
                      w.checklist?.docPackDone,
                  ).length
                : k === "incomplete"
                  ? wos.filter(
                      (w) =>
                        !(
                          w.checklist?.finalInspectionPassed &&
                          w.checklist?.packingDone &&
                          w.checklist?.docPackDone
                        ),
                    ).length
                  : wos.filter((w) => w.complete).length}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading dispatch board…
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-slate-700">
            <Truck className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-bold text-white">
              Dispatchable Work Orders
            </span>
            <span className="text-xs text-slate-500 ml-auto">
              Gate pass requires all 3 sign-offs + released data package
            </span>
          </div>
          <div className="divide-y divide-slate-700/40">
            {wos.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-sm">
                No dispatchable work orders (status COMPLETED).
              </div>
            )}
            {wos.map((w) => {
              const cl = w.checklist;
              const ok =
                !!cl?.finalInspectionPassed &&
                !!cl?.packingDone &&
                !!cl?.docPackDone;
              return (
                <div
                  key={w.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-700/20"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">
                        {w.woNumber}
                      </span>
                      <span className="text-xs text-slate-400">
                        {w.product?.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {w.customerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded ${cl?.finalInspectionPassed ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-400"}`}
                      >
                        FINAL INSP
                      </span>
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded ${cl?.packingDone ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-400"}`}
                      >
                        PACKING
                      </span>
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded ${cl?.docPackDone ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-400"}`}
                      >
                        DOC PACK
                      </span>
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded ${w.releasedDp ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-400"}`}
                      >
                        DATA PKG
                      </span>
                      {ok && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-sky-600 text-white">
                          DISPATCH READY
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!ok && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openFor(w)}
                      >
                        Fill checklist
                      </Button>
                    )}
                    {ok && (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" /> Complete
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-white">
              FQC Dispatch Checklist —{" "}
              {wos.find((w) => w.id === open)?.woNumber}
            </h3>
            {[
              {
                key: "finalInspectionPassed",
                label: "Final inspection passed (dimensional + visual)",
                icon: <FileCheck2 className="h-4 w-4 text-emerald-400" />,
              },
              {
                key: "packingDone",
                label: "Packing complete (qty, protection, labelling)",
                icon: <PackageCheck className="h-4 w-4 text-sky-400" />,
              },
              {
                key: "docPackDone",
                label: "Doc pack complete — MTC / COC / test reports",
                icon: <FileCheck2 className="h-4 w-4 text-amber-400" />,
              },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-700 cursor-pointer hover:border-emerald-500/50"
              >
                <input
                  type="checkbox"
                  checked={!!form[item.key]}
                  onChange={(e) =>
                    setForm({ ...form, [item.key]: e.target.checked })
                  }
                  className="w-4 h-4 accent-emerald-500"
                />
                {item.icon}
                <span className="text-sm text-slate-200">{item.label}</span>
              </label>
            ))}
            <textarea
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              placeholder="Notes (audit trail)…"
            />
            {allChecked && (
              <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
                All sign-offs present — the gate-pass gate will now allow
                dispatch (data package must be RELEASED).
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setOpen(null)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save checklist"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          {msg}
        </div>
      )}
    </div>
  );
}
