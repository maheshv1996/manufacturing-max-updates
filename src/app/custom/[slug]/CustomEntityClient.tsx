"use client";

import { useState } from "react";
import PageHeader from "@/app/components/shared/PageHeader";
import { Layers, Plus } from "lucide-react";
import { toast } from "@/lib/toastStore";

export default function CustomEntityClient({ entity, initialRecords }: { entity: any; initialRecords: any[] }) {
  const [records, setRecords] = useState(initialRecords);
  const [values, setValues] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/custom/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: entity.slug, values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setRecords([data.record, ...records]);
      setValues({});
      toast.success("Record created — Flow hook would fire here");
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={entity.title}
        description={entity.description || `${entity.fields.length} fields — infinite entity`}
        icon={<Layers className="w-6 h-6" />}
        iconTone={(entity.colorTone as any) || "violet"}
        badge={{ label: `${records.length} records`, tone: "info" }}
      />

      <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Plus className="w-4 h-4 text-violet-400" /> New Record</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {entity.fields.map((f: any) => (
            <div key={f.id} className="space-y-1.5">
              <label className="text-xs font-bold text-white/80 font-mono">{f.label} {f.required && <span className="text-rose-400">*</span>}</label>
              {f.fieldType === "select" ? (
                <select
                  value={values[f.key] || ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white"
                  required={f.required}
                >
                  <option value="">{f.placeholder || "Select"}</option>
                  {(f.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.fieldType === "boolean" ? (
                <select value={String(values[f.key] ?? "")} onChange={(e) => setValues({ ...values, [f.key]: e.target.value === "true" })} className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white">
                  <option value="">Select</option>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : (
                <input
                  type={f.fieldType === "number" ? "number" : f.fieldType === "date" ? "date" : "text"}
                  value={values[f.key] || ""}
                  onChange={(e) => setValues({ ...values, [f.key]: f.fieldType === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value })}
                  placeholder={f.placeholder || ""}
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white"
                  required={f.required}
                />
              )}
            </div>
          ))}
        </div>
        <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm disabled:opacity-50">
          {busy ? "Saving..." : "Create Record"}
        </button>
        <p className="text-[11px] text-white/40">Flow hook: this POST would trigger any Automation Flow subscribed to <span className="font-mono text-violet-300">CustomRecord.created:{entity.slug}</span></p>
      </form>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm font-bold text-white">Records</span>
          <span className="text-xs font-mono text-white/50">{records.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-700">
                <th className="py-3 px-4">Created</th>
                {entity.fields.map((f: any) => <th key={f.id} className="py-3 px-4">{f.label}</th>)}
                <th className="py-3 px-4">By</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={entity.fields.length + 2} className="py-8 text-center text-slate-500">No records yet — add one above.</td></tr>
              ) : records.map((r: any) => (
                <tr key={r.id} className="border-b border-slate-700/40 hover:bg-white/[0.03]">
                  <td className="py-3 px-4 font-mono text-xs text-slate-400">{new Date(r.createdAt).toLocaleString()}</td>
                  {entity.fields.map((f: any) => <td key={f.id} className="py-3 px-4 font-mono text-white">{String(r.values?.[f.key] ?? "—")}</td>)}
                  <td className="py-3 px-4 text-xs text-slate-400">{r.createdBy || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
