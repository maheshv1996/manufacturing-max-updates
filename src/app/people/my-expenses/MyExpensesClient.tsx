"use client";

import { useEffect, useState } from "react";
import { Receipt, Plus, X, Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";
import { Card, CardHeader, CardContent, Button, Input, Select, StatusPill } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";

type Item = { id: string; category: string; description: string; amount: number; expenseDate?: string | null };
type Claim = {
  id: string;
  claimNumber: string;
  status: string;
  totalAmount: number;
  category: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  items: Item[];
};

const CATEGORY_META: Record<string, { label: string; cls: string }> = {
  TRAVEL: { label: "Travel", cls: "text-sky-400 bg-sky-500/10" },
  FUEL: { label: "Fuel", cls: "text-amber-400 bg-amber-500/10" },
  FOOD: { label: "Food & Dining", cls: "text-orange-400 bg-orange-500/10" },
  STATIONERY: { label: "Stationery", cls: "text-slate-300 bg-slate-500/10" },
  MARKETING: { label: "Marketing", cls: "text-purple-400 bg-purple-500/10" },
  REPAIR: { label: "Repairs", cls: "text-rose-400 bg-rose-500/10" },
  UTILITY: { label: "Utilities", cls: "text-teal-400 bg-teal-500/10" },
  QUALITY: { label: "Quality", cls: "text-emerald-400 bg-emerald-500/10" },
  TOOLING: { label: "Tooling", cls: "text-indigo-400 bg-indigo-500/10" },
  SUBCONTRACT: { label: "Subcontract", cls: "text-cyan-400 bg-cyan-500/10" },
  TRAINING: { label: "Training", cls: "text-lime-400 bg-lime-500/10" },
  OTHER: { label: "Other", cls: "text-slate-400 bg-slate-500/10" },
};
const STATUS_META: Record<string, { label: string; tone: string }> = {
  SUBMITTED: { label: "Submitted", tone: "info" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  PAID: { label: "Paid", tone: "neutral" },
};
const fmt = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtD = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export default function MyExpensesClient() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [stats, setStats] = useState({ submitted: 0, approved: 0, paidTotal: 0, outstanding: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState([{ key: Date.now(), category: "TRAVEL", description: "", amount: "" }]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const load = async () => {
    try {
      const res = await fetch("/api/people/expenses");
      if (res.ok) {
        const d = await res.json();
        setClaims(d.claims || []);
        setStats(d.stats || stats);
      }
    } catch {
      toast.error("Failed to load your claims");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    const clean = rows.filter((r) => r.description.trim() && Number(r.amount) > 0);
    if (clean.length === 0) {
      toast.error("Add at least one item with a description and amount");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/people/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            expenseDate: date || undefined,
            notes: notes.trim() || undefined,
            items: clean.map((r) => ({ category: r.category, description: r.description.trim(), amount: Number(r.amount) })),
          },
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.claim) {
        toast.error(d.error || "Submission failed");
        return;
      }
      soundFx.playSuccess();
      toast.success(`Claim ${d.claim.claimNumber} submitted for approval`);
      setOpen(false);
      setDate(new Date().toISOString().slice(0, 10));
      setNotes("");
      setRows([{ key: Date.now(), category: "TRAVEL", description: "", amount: "" }]);
      await load();
    } catch {
      toast.error("Submission failed");
    } finally {
      setSaving(false);
    }
  };

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Expense Claims"
        description="Submit reimbursements for travel, fuel, meals and more. Claims route to your manager for approval and are paid once approved."
        icon={<Receipt className="h-5 w-5 text-emerald-500" />}
        iconTone="blue"
        badge={{ label: "SELF SERVICE", tone: "new" }}
      >
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Submit a Claim
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">In Review</p>
          <p className="text-2xl font-black text-sky-400 mt-1">{stats.submitted}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Approved (not yet paid)</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{stats.approved}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Reimbursed To Date</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{fmt(stats.paidTotal)}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Outstanding</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{fmt(stats.outstanding)}</p>
        </Card>
      </div>

      <Card>
        <CardHeader title="My Claims" subtitle={`${claims.length} submitted`} icon={<Receipt className="h-4 w-4" />} />
        <CardContent className="!p-0">
          {loading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
            </div>
          ) : claims.length === 0 ? (
            <p className="px-4 py-10 text-center text-slate-400 text-sm">
              You have not submitted any expense claims yet.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {claims.map((c) => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-mono text-sm text-white">{c.claimNumber}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_META[c.category]?.cls || CATEGORY_META.OTHER.cls}`}>
                        {CATEGORY_META[c.category]?.label || c.category}
                      </span>
                      <StatusPill variant={STATUS_META[c.status]?.tone as any} label={STATUS_META[c.status]?.label || c.status} />
                    </div>
                    <span className="font-mono text-sm font-bold text-white">{fmt(c.totalAmount)}</span>
                  </div>
                  <div className="mt-2 grid sm:grid-cols-2 gap-1.5 pl-0">
                    {c.items.map((it) => (
                      <p key={it.id} className="text-xs text-slate-400 flex justify-between border-b border-white/5 pb-1">
                        <span>
                          <span className="text-slate-500 mr-1.5">{CATEGORY_META[it.category]?.label || it.category}:</span>
                          {it.description}
                        </span>
                        <span className="font-mono text-slate-300">{fmt(it.amount)}</span>
                      </p>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Submitted {fmtD(c.submittedAt)}
                    {c.approvedAt ? ` · Approved ${fmtD(c.approvedAt)}` : ""}
                    {c.paidAt ? ` · Paid ${fmtD(c.paidAt)}` : ""}
                    {c.status === "REJECTED" && c.rejectionReason ? (
                      <span className="text-rose-400"> · Rejected: {c.rejectionReason}</span>
                    ) : (
                      ""
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-xl bg-slate-900 rounded-2xl border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="expense-modal-title"
          >
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 id="expense-modal-title" className="text-lg font-bold text-white">Submit Expense Claim</h3>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Expense Date</label>
                <Input type="date" className="!w-44" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Items</label>
                  <Button variant="ghost" size="sm" onClick={() => setRows([...rows, { key: Date.now(), category: "TRAVEL", description: "", amount: "" }])}>
                    <Plus className="size-3.5" /> Add
                  </Button>
                </div>
                <div className="rounded-xl border border-white/10 divide-y divide-white/5">
                  {rows.map((r, idx) => (
                    <div key={r.key} className="flex gap-2 p-2 items-start">
                      <Select value={r.category} onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, category: e.target.value } : x)))} className="!w-32">
                        {Object.keys(CATEGORY_META).map((c) => (
                          <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                        ))}
                      </Select>
                      <Input className="flex-1" value={r.description} placeholder="What was it for?" onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))} />
                      <Input className="!w-24" type="number" min={0} value={r.amount} placeholder="₹" onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)))} />
                      <button onClick={() => setRows(rows.filter((_, i) => i !== idx))} disabled={rows.length === 1} className="p-2 rounded-lg text-slate-500 hover:text-rose-400 disabled:opacity-30">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-right text-sm font-mono font-black text-white mt-2">Total: {fmt(total)}</p>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Notes</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — e.g. 'Client visit to Pune plant'"
                  className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-4 py-2 text-white text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="primary" isLoading={saving} onClick={submit}>
                  <CheckCircle2 className="size-4" /> Submit for Approval
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
