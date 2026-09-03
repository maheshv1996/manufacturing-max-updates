"use client";

import PageHeader from "@/app/components/shared/PageHeader";

import {useCallback, useEffect, useState } from "react";
import { Loader2, FileText, Plus,
  ShieldCheck
} from "lucide-react";
import { Button, Input, Select } from "@/app/components/ui";

const DOC_TYPES = ["POLICY", "PROCEDURE", "WORK_INSTRUCTION", "FORM", "RECORD"];

export default function QmsDocsClient() {
  const [docs, setDocs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/qms-docs", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setDocs(data.docs || []);
        setStats(data.stats || {});
      }
    } catch {
      setMsg("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/qms-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing?.id ? { ...form, id: editing.id } : form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Save failed");
        return;
      }
      setEditing(null);
      await load();
      setMsg(
        editing?.id
          ? "Document updated"
          : "Document created — review clock starts",
      );
    } catch {
      setMsg("Save failed");
    } finally {
      setBusy(false);
    }
  };

  const newDoc = () => {
    setEditing({});
    const inYear = new Date();
    inYear.setFullYear(inYear.getFullYear() + 1);
    setForm({
      docType: "PROCEDURE",
      revision: "A",
      status: "CURRENT",
      owner: "Quality Manager",
      nextReviewAt: inYear.toISOString().slice(0, 10),
    });
  };

  const editDoc = (d: any) => {
    setEditing(d);
    setForm({
      ...d,
      nextReviewAt: new Date(d.nextReviewAt).toISOString().slice(0, 10),
      approvedAt: d.approvedAt
        ? new Date(d.approvedAt).toISOString().slice(0, 10)
        : "",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Qms Docs"
        description="Inspections, NCRs, audits and compliance control."
        icon={<ShieldCheck className="w-6 h-6" />}
        iconTone="emerald"
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          ["total", "Documents", "text-white"],
          ["current", "Current", "text-emerald-300"],
          ["underReview", "Under review", "text-sky-300"],
          ["dueSoon", "Due ≤30d", "text-amber-300"],
          ["overdue", "Overdue", "text-rose-300"],
        ].map(([k, label, cls]) => (
          <div
            key={k}
            className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4"
          >
            <div className="text-xs text-slate-400">{label}</div>
            <div className={`text-2xl font-black mt-1 ${cls}`}>
              {stats[k] ?? 0}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={newDoc}>
          <Plus className="h-4 w-4 mr-1" /> New document
        </Button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Loading document register…
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
          <div className="divide-y divide-slate-700/40">
            {docs.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-sm">
                No documents yet — create the first controlled document.
              </div>
            )}
            {docs.map((d) => (
              <div
                key={d.id}
                className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-700/20"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="font-mono font-bold text-white">
                      {d.docNumber}
                    </span>
                    <span className="text-sm text-slate-200 truncate">
                      {d.title}
                    </span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                      {d.docType}
                    </span>
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded ${d.status === "CURRENT" ? "bg-emerald-600 text-white" : d.status === "UNDER_REVIEW" ? "bg-sky-600 text-white" : "bg-slate-600 text-white"}`}
                    >
                      {d.status}
                    </span>
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded ${d.overdue ? "bg-rose-600 text-white" : d.dueSoon ? "bg-amber-500 text-black" : "bg-emerald-600/30 text-emerald-300"}`}
                    >
                      {d.overdue
                        ? `REVIEW OVERDUE`
                        : d.dueSoon
                          ? `DUE ${d.daysLeft}d`
                          : `ok · ${d.daysLeft}d`}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    rev {d.revision} · owner {d.owner} · next review{" "}
                    {new Date(d.nextReviewAt).toLocaleDateString()}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => editDoc(d)}>
                  Review
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-white">
              {editing.id ? `Review ${editing.docNumber}` : "New QMS document"}
            </h3>
            <div>
              <label className="text-xs text-slate-400">Title *</label>
              <Input
                value={form.title || ""}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Calibration Control Procedure"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Type</label>
                <Select
                  value={form.docType}
                  onChange={(e) =>
                    setForm({ ...form, docType: e.target.value })
                  }
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Revision</label>
                <Input
                  value={form.revision || ""}
                  onChange={(e) =>
                    setForm({ ...form, revision: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Owner</label>
                <Input
                  value={form.owner || ""}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Status</label>
                <Select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {["CURRENT", "UNDER_REVIEW", "OBSOLETE"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Next review *</label>
                <Input
                  type="date"
                  value={form.nextReviewAt || ""}
                  onChange={(e) =>
                    setForm({ ...form, nextReviewAt: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Approved date</label>
                <Input
                  type="date"
                  value={form.approvedAt || ""}
                  onChange={(e) =>
                    setForm({ ...form, approvedAt: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400">Notes</label>
              <textarea
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
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
