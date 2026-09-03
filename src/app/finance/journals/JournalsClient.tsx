"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Undo2,
  ChevronDown,
  ChevronUp,
  Scale,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";
import { Card, CardHeader, CardContent, Button, Input, Select, StatusPill } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";

interface GlAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  group: string | null;
  normalBalance: "DEBIT" | "CREDIT";
  isActive: boolean;
}

interface JournalLine {
  id: string;
  debit: number;
  credit: number;
  reference: string | null;
  narration: string | null;
  account: { code: string; name: string; type: string };
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  period: string | null;
  memo: string;
  status: "DRAFT" | "POSTED" | "REVERSED";
  source: string;
  sourceId: string | null;
  totalDebit: number;
  totalCredit: number;
  createdBy: string;
  postedBy: string | null;
  postedAt: string | null;
  lines: JournalLine[];
}

interface DraftLine {
  key: number;
  accountId: string;
  debit: string;
  credit: string;
  reference: string;
  narration: string;
}

const fmt = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function JournalsClient() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [stats, setStats] = useState({ posted: 0, reversed: 0, postedValueYear: 0 });
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Composer state
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { key: 1, accountId: "", debit: "", credit: "", reference: "", narration: "" },
    { key: 2, accountId: "", debit: "", credit: "", reference: "", narration: "" },
  ]);
  const [posting, setPosting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    Promise.all([
      fetch("/api/finance/journals").then((r) => r.json()),
      fetch("/api/finance/gl-accounts").then((r) => r.json()),
    ])
      .then(([j, a]) => {
        if (j.success) {
          setEntries(j.entries);
          setStats(j.stats);
        }
        if (a.success) setAccounts(a.accounts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.isActive).sort((a, b) => a.code.localeCompare(b.code)),
    [accounts],
  );

  const totals = useMemo(() => {
    let dr = 0;
    let cr = 0;
    for (const l of lines) {
      dr += Number(l.debit) || 0;
      cr += Number(l.credit) || 0;
    }
    return { debit: Math.round(dr * 100) / 100, credit: Math.round(cr * 100) / 100 };
  }, [lines]);

  const balanced = Math.abs(totals.debit - totals.credit) < 0.01 && totals.debit > 0;

  const updateLine = (key: number, patch: Partial<DraftLine>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const addLine = () => {
    setLines((ls) => [
      ...ls,
      { key: Date.now(), accountId: "", debit: "", credit: "", reference: "", narration: "" },
    ]);
  };

  const removeLine = (key: number) => {
    setLines((ls) => (ls.length > 2 ? ls.filter((l) => l.key !== key) : ls));
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memo.trim()) {
      toast.error("Enter a memo for the entry");
      return;
    }
    const cleanLines = lines
      .filter((l) => l.accountId && ((Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0))
      .map((l) => ({
        accountId: l.accountId,
        debit: l.debit ? Number(l.debit) : undefined,
        credit: l.credit ? Number(l.credit) : undefined,
        reference: l.reference || undefined,
        narration: l.narration || undefined,
      }));
    if (cleanLines.length < 2) {
      toast.error("Add at least two lines with amounts");
      return;
    }
    if (!balanced) {
      toast.error(`Entry does not balance — debit ${totals.debit.toFixed(2)} vs credit ${totals.credit.toFixed(2)}`);
      return;
    }

    setPosting(true);
    try {
      const res = await fetch("/api/finance/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          memo: memo.trim(),
          lines: cleanLines,
          clientId: `je-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to post journal entry");
        return;
      }
      soundFx.playSuccess();
      toast.success(`${data.entry.entryNumber} posted — ₹${data.entry.totalDebit.toLocaleString("en-IN")}`);
      setMemo("");
      setLines([
        { key: Date.now() + 1, accountId: "", debit: "", credit: "", reference: "", narration: "" },
        { key: Date.now() + 2, accountId: "", debit: "", credit: "", reference: "", narration: "" },
      ]);
      load();
    } catch {
      toast.error("Failed to post journal entry");
    } finally {
      setPosting(false);
    }
  };

  const handleReverse = async (id: string) => {
    if (!window.confirm("Reverse this entry with a mirror-image reversal? The original is marked REVERSED.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/finance/journals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reverse",
          clientId: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to reverse entry");
        return;
      }
      soundFx.playSuccess();
      toast.success(`Reversal posted — ${data.reversal.entryNumber}`);
      load();
    } catch {
      toast.error("Failed to reverse entry");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal Entries"
        description="Post balanced double-entry journals to the general ledger. Every entry must balance before it posts; posted entries can be reversed with an audit trail."
        icon={<FileText className="h-5 w-5 text-emerald-500" />}
        iconTone="emerald"
        badge={{ label: "DOUBLE-ENTRY GL", tone: "new" }}
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Posted Entries</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{stats.posted}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Reversed</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{stats.reversed}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Posted Value (FY)</p>
          <p className="text-2xl font-black text-white mt-1">{fmt(stats.postedValueYear)}</p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Composer */}
        <Card className="lg:col-span-2 h-fit">
          <CardHeader
            title="New Journal Entry"
            subtitle="Debits must equal credits"
            icon={<Plus className="h-4 w-4" />}
            action={
              <StatusPill
                variant={balanced ? "success" : "danger"}
                label={balanced ? "BALANCED" : `Δ ${(totals.debit - totals.credit).toFixed(2)}`}
                dot
              />
            }
          />
          <CardContent>
            <form onSubmit={handlePost} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <Input
                  label="Memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="e.g. Depreciation for April"
                  className="col-span-2"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lines</p>
                  <Button type="button" variant="ghost" size="sm" onClick={addLine}>
                    <Plus className="size-3.5" /> Add line
                  </Button>
                </div>

                <div className="grid grid-cols-12 gap-2 text-[11px] uppercase tracking-wider text-slate-500 px-1">
                  <span className="col-span-5">Account</span>
                  <span className="col-span-3">Debit</span>
                  <span className="col-span-3">Credit</span>
                  <span className="col-span-1" />
                </div>

                {lines.map((l) => (
                  <div key={l.key} className="grid grid-cols-12 gap-2 items-center">
                    <Select
                      className="col-span-5 !py-2 text-xs"
                      value={l.accountId}
                      onChange={(e) => updateLine(l.key, { accountId: e.target.value })}
                    >
                      <option value="">Select…</option>
                      {activeAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      className="col-span-3 !py-2 text-xs font-mono"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={l.debit}
                      onChange={(e) => updateLine(l.key, { debit: e.target.value, credit: "" })}
                    />
                    <Input
                      className="col-span-3 !py-2 text-xs font-mono"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={l.credit}
                      onChange={(e) => updateLine(l.key, { credit: e.target.value, debit: "" })}
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(l.key)}
                      className="col-span-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Remove line"
                    >
                      <Trash2 className="size-4 mx-auto" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2.5 text-sm">
                  <span className="text-slate-400 font-medium">Totals</span>
                  <span className="flex items-center gap-4 font-mono">
                    <span className="text-emerald-400">{fmt(totals.debit)}</span>
                    <Scale className="size-3.5 text-slate-500" />
                    <span className="text-amber-400">{fmt(totals.credit)}</span>
                  </span>
                </div>
              </div>

              <Button type="submit" variant="success" isLoading={posting} className="w-full" disabled={!balanced}>
                <Plus className="size-4" /> Post Entry (JE-{new Date().getFullYear()}-…)
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="lg:col-span-3">
          <CardHeader
            title="Entry Register"
            subtitle={`${entries.length} entries · newest first`}
            icon={<FileText className="h-4 w-4" />}
          />
          <CardContent className="!p-0">
            <div className="max-h-[720px] overflow-y-auto">
              {loading ? (
                <p className="px-4 py-10 text-center text-slate-400">Loading journal entries…</p>
              ) : entries.length === 0 ? (
                <p className="px-4 py-10 text-center text-slate-400">
                  No journal entries yet — post your first entry on the left.
                </p>
              ) : (
                entries.map((e) => (
                  <div key={e.id} className="border-b border-white/5">
                    <div className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors">
                      <button
                        className="flex items-center gap-3 min-w-0 text-left flex-1"
                        onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                      >
                        {expanded === e.id ? (
                          <ChevronUp className="size-4 text-slate-500 shrink-0" />
                        ) : (
                          <ChevronDown className="size-4 text-slate-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-mono text-sm text-white truncate">
                            {e.entryNumber}{" "}
                            <span className="text-slate-500 font-sans font-normal">
                              · {new Date(e.date).toLocaleDateString("en-IN")} · {e.source}
                            </span>
                          </p>
                          <p className="text-xs text-slate-400 truncate max-w-[420px]">{e.memo}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-sm text-slate-200">{fmt(e.totalDebit)}</span>
                        <StatusPill
                          variant={e.status === "POSTED" ? "success" : e.status === "REVERSED" ? "warning" : "draft"}
                          label={e.status}
                        />
                        {e.status === "POSTED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReverse(e.id)}
                            isLoading={busyId === e.id}
                            title="Reverse this entry"
                          >
                            <Undo2 className="size-3.5" /> Reverse
                          </Button>
                        )}
                      </div>
                    </div>
                    {expanded === e.id && (
                      <div className="px-4 pb-4 pl-12 space-y-1">
                        {e.lines.map((l) => (
                          <div
                            key={l.id}
                            className="grid grid-cols-12 gap-2 text-xs items-center py-1 border-t border-white/5"
                          >
                            <span className="col-span-4 text-slate-300 font-mono">
                              {l.account.code} · {l.account.name}
                            </span>
                            <span className="col-span-2 font-mono text-emerald-400">
                              {l.debit > 0 ? fmt(l.debit) : "—"}
                            </span>
                            <span className="col-span-2 font-mono text-amber-400">
                              {l.credit > 0 ? fmt(l.credit) : "—"}
                            </span>
                            <span className="col-span-4 text-slate-500 truncate">
                              {[l.reference, l.narration].filter(Boolean).join(" · ") || "—"}
                            </span>
                          </div>
                        ))}
                        <p className="text-[11px] text-slate-500 pt-1">
                          By {e.createdBy}
                          {e.postedAt ? ` · posted ${new Date(e.postedAt).toLocaleString("en-IN")}` : ""}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}