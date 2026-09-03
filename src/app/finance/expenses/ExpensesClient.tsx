"use client";

import { useEffect, useState } from "react";
import {
  Receipt,
  Plus,
  Loader2,
  X,
  CheckCircle2,
  Ban,
  Banknote,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";
import { Card, CardHeader, CardContent, Button, Input, Select, StatusPill } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";

type Item = {
  id: string;
  category: string;
  description: string;
  amount: number;
  expenseDate?: string | null;
};
type Claim = {
  id: string;
  claimNumber: string;
  claimantName: string;
  claimantCode: string | null;
  totalAmount: number;
  status: string;
  category: string;
  expenseDate: string;
  submittedAt?: string | null;
  approvedBy?: string | null;
  paidAt?: string | null;
  paidBy?: string | null;
  rejectionReason?: string | null;
  treasuryRef?: string | null;
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
const CATEGORIES = Object.keys(CATEGORY_META);

const fmt = (n: number) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtD = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

interface DraftItem {
  key: number;
  category: string;
  description: string;
  amount: string;
}

export default function ExpensesClient() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [stats, setStats] = useState({ openApprovals: 0, paidTotal: 0, approvedOutstanding: 0, monthTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({
    claimantName: "",
    claimantCode: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [items, setItems] = useState<DraftItem[]>([
    { key: Date.now(), category: "TRAVEL", description: "", amount: "" },
  ]);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/finance/expenses");
      if (res.ok) {
        const d = await res.json();
        setClaims(d.claims || []);
        setStats(d.stats || stats);
      }
    } catch {
      toast.error("Failed to load expense claims");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (action: string, claim: Claim) => {
    let reason: string | null = null;
    if (action === "approve") {
      reason = window.prompt(`Approve ${claim.claimNumber} (reason required)?`, "Approved — eligible reimbursement");
    } else if (action === "reject") {
      reason = window.prompt(`Reject ${claim.claimNumber} — reason required`, "");
    } else if (action === "pay") {
      reason = window.prompt(`Pay ${claim.claimNumber} — ${fmt(claim.totalAmount)} (note)?`, "Reimbursement via bank");
    }
    if (action !== "approve" && action !== "reject" && action !== "pay") return;
    if (action === "reject" && !reason) {
      toast.error("Rejection reason required");
      return;
    }
    if (action === "approve" && !reason) return;
    setSaving(true);
    try {
      const res = await fetch("/api/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: { id: claim.id, reason, method: "Bank" } }),
      });
      const d = await res.json();
      if (!res.ok || (!d.claim && !d.success)) {
        toast.error(d.error || "Action failed");
        return;
      }
      soundFx.playSuccess();
      const label = action === "approve" ? "approved" : action === "reject" ? "rejected" : "paid out";
      toast.success(`${claim.claimNumber} ${label} — ${fmt(claim.totalAmount)}`);
      await fetchData();
    } catch {
      toast.error("Action failed");
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!form.claimantName.trim()) {
      toast.error("Claimant name required");
      return;
    }
    const cleanItems = items
      .filter((i) => i.description.trim() && Number(i.amount) > 0)
      .map((i) => ({ category: i.category, description: i.description.trim(), amount: Number(i.amount), expenseDate: form.expenseDate }));
    if (cleanItems.length === 0) {
      toast.error("Add at least one expense item with description and amount");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          data: {
            claimantName: form.claimantName.trim(),
            claimantCode: form.claimantCode.trim() || undefined,
            expenseDate: form.expenseDate || undefined,
            notes: form.notes.trim() || undefined,
            items: cleanItems,
          },
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.claim) {
        toast.error(d.error || "Failed to submit claim");
        return;
      }
      soundFx.playSuccess();
      toast.success(`Claim ${d.claim.claimNumber} submitted`);
      setModal(false);
      setForm({ claimantName: "", claimantCode: "", expenseDate: new Date().toISOString().slice(0, 10), notes: "" });
      setItems([{ key: Date.now(), category: "TRAVEL", description: "", amount: "" }]);
      await fetchData();
    } catch {
      toast.error("Failed to submit claim");
    } finally {
      setSaving(false);
    }
  };

  const draftTotal = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Claims"
        description="Staff reimbursements — submit itemized claims, manager approve, pay and auto-post to the ledger."
        icon={<Receipt className="h-5 w-5 text-emerald-500" />}
        iconTone="blue"
        badge={{ label: "REIMBURSEMENTS", tone: "new" }}
      >
        <Button variant="primary" onClick={() => setModal(true)}>
          <Plus className="size-4" /> New Expense Claim
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Open Approvals</p>
          <p className="text-2xl font-black text-white mt-1">{stats.openApprovals}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Approved — Awaiting Pay</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{fmt(stats.approvedOutstanding)}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Paid This Run</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{fmt(stats.paidTotal)}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Submitted This Month</p>
          <p className="text-2xl font-black text-sky-400 mt-1">{fmt(stats.monthTotal)}</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Claim Register"
          subtitle={`${claims.length} claims · newest first`}
          icon={<Receipt className="h-4 w-4" />}
        />
        <CardContent className="!p-0">
          {loading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
            </div>
          ) : claims.length === 0 ? (
            <p className="px-4 py-10 text-center text-slate-400 text-sm">
              No expense claims yet — submit the first one.
            </p>
          ) : (
            <div className="max-h-[680px] overflow-y-auto divide-y divide-white/5">
              {claims.map((c) => (
                <div key={c.id}>
                  <div className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.03]">
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    >
                      <div className="flex items-center gap-2">
                        {expanded === c.id ? (
                          <ChevronUp className="size-4 text-slate-500 shrink-0" />
                        ) : (
                          <ChevronDown className="size-4 text-slate-500 shrink-0" />
                        )}
                        <p className="font-mono text-sm text-white">{c.claimNumber}</p>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_META[c.category]?.cls || CATEGORY_META.OTHER.cls}`}
                        >
                          {CATEGORY_META[c.category]?.label || c.category}
                        </span>
                        <StatusPill
                          variant={STATUS_META[c.status]?.tone as any}
                          label={STATUS_META[c.status]?.label || c.status}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {c.claimantName}
                        {c.claimantCode ? ` · ${c.claimantCode}` : ""} · submitted {fmtD(c.submittedAt)} ·{" "}
                        {c.items.length} item(s)
                      </p>
                    </button>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-sm font-bold text-white">{fmt(c.totalAmount)}</span>
                      {c.status === "SUBMITTED" && (
                        <>
                          <Button variant="success" size="sm" isLoading={saving} onClick={() => act("approve", c)}>
                            <CheckCircle2 className="size-3.5" /> Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            isLoading={saving}
                            onClick={() => act("reject", c)}
                            title={`Reject ${c.claimNumber}`}
                          >
                            <Ban className="size-3.5" /> Reject
                          </Button>
                        </>
                      )}
                      {c.status === "APPROVED" && (
                        <Button variant="primary" size="sm" isLoading={saving} onClick={() => act("pay", c)}>
                          <Banknote className="size-3.5" /> Pay {fmt(c.totalAmount)}
                        </Button>
                      )}
                    </div>
                  </div>
                  {expanded === c.id && (
                    <div className="px-4 pb-4 pl-12">
                      <div className="overflow-x-auto rounded-xl border border-white/5">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-white/[0.03] border-b border-white/5">
                            <tr className="text-slate-500">
                              <th className="px-3 py-2 font-semibold">Category</th>
                              <th className="px-3 py-2 font-semibold">Description</th>
                              <th className="px-3 py-2 font-semibold">Date</th>
                              <th className="px-3 py-2 text-right font-semibold">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {c.items.map((it) => (
                              <tr key={it.id}>
                                <td className="px-3 py-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${CATEGORY_META[it.category]?.cls || ""}`}>
                                    {CATEGORY_META[it.category]?.label || it.category}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-300">{it.description}</td>
                                <td className="px-3 py-2 text-slate-500">{fmtD(it.expenseDate)}</td>
                                <td className="px-3 py-2 text-right font-mono text-slate-200">{fmt(it.amount)}</td>
                              </tr>
                            ))}
                            <tr className="bg-white/[0.03]">
                              <td colSpan={3} className="px-3 py-2 font-bold text-right text-slate-400">
                                {c.rejectionReason ? `Rejected: ${c.rejectionReason}` : c.notes || "Total"}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-black text-white">{fmt(c.totalAmount)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE MODAL */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 rounded-2xl border border-white/10 shadow-2xl">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">New Expense Claim</h3>
              <button onClick={() => setModal(false)} className="p-2 rounded-lg hover:bg-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Claimant Name *
                  </label>
                  <Input
                    value={form.claimantName}
                    onChange={(e) => setForm({ ...form, claimantName: e.target.value })}
                    placeholder="e.g. Priya Nair"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Employee Code
                  </label>
                  <Input
                    value={form.claimantCode}
                    onChange={(e) => setForm({ ...form, claimantCode: e.target.value })}
                    placeholder="e.g. 1001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Expense Date
                  </label>
                  <Input
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Line Items
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setItems([...items, { key: Date.now(), category: "TRAVEL", description: "", amount: "" }])
                    }
                  >
                    <Plus className="size-3.5" /> Add item
                  </Button>
                </div>
                <div className="rounded-xl border border-white/10 divide-y divide-white/5">
                  {items.map((it, idx) => (
                    <div key={it.key} className="flex gap-2 p-2 items-start">
                      <Select
                        value={it.category}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = { ...it, category: e.target.value };
                          setItems(next);
                        }}
                        className="!w-36"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {CATEGORY_META[c].label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        className="flex-1"
                        value={it.description}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = { ...it, description: e.target.value };
                          setItems(next);
                        }}
                        placeholder="What was this for?"
                      />
                      <Input
                        className="!w-28"
                        type="number"
                        min={0}
                        step="any"
                        value={it.amount}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = { ...it, amount: e.target.value };
                          setItems(next);
                        }}
                        placeholder="₹"
                      />
                      <button
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        disabled={items.length === 1}
                        className="p-2 rounded-lg text-slate-500 hover:text-rose-400 disabled:opacity-30"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-right text-sm font-mono font-black text-white mt-2">
                  Total: {fmt(draftTotal)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional context for the approver"
                  className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" isLoading={saving} onClick={submit}>
                  <CheckCircle2 className="size-4" /> Submit Claim
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
