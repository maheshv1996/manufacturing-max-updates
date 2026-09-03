"use client";

import { useEffect, useState } from "react";
import {
  History,
  Play,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { Card, CardHeader, CardContent, Button, StatusPill } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";

const KIND_META: Record<string, { label: string; variant: "success" | "info" | "warning" | "danger" }> = {
  sales_invoice: { label: "Sales invoice", variant: "success" },
  customer_payment: { label: "Customer payment", variant: "success" },
  supplier_invoice: { label: "Supplier invoice", variant: "info" },
  supplier_payment: { label: "Supplier payment", variant: "info" },
  expense_payment: { label: "Expense reimbursement", variant: "warning" },
  payroll_payment: { label: "Payroll settlement", variant: "warning" },
  payroll_accrual: { label: "Payroll accrual", variant: "warning" },
};

interface Candidate {
  kind: string;
  docNumber: string;
  memo: string;
}

export default function GlBackfillClient() {
  const [total, setTotal] = useState<number | null>(null);
  const [byKind, setByKind] = useState<Record<string, number>>({});
  const [samples, setSamples] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ posted: number; skipped: number; failed: unknown[] } | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/finance/gl-backfill");
      if (res.ok) {
        const d = await res.json();
        setTotal(d.total ?? 0);
        setByKind(d.byKind || {});
        setSamples(d.samples || []);
      } else {
        toast.error("Failed to load backfill preview");
      }
    } catch {
      toast.error("Failed to load backfill preview");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/finance/gl-backfill", { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Backfill failed");
        return;
      }
      const r = d.result || { posted: 0, skipped: 0, failed: [] };
      setResult(r);
      toast.success(
        r.posted > 0
          ? `Backfilled ${r.posted} document${r.posted === 1 ? "" : "s"} into the ledger`
          : "Ledger is already complete — nothing to backfill",
      );
      await load();
    } catch {
      toast.error("Backfill failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="GL Backfill Workbench"
        description="Documents created before automatic ledger posting shipped never reached the books. This replays each flow's exact journal recipe from the stored rows — sales invoices, customer & supplier payments, expense reimbursements, payroll settlements and accruals."
        icon={<History className="h-5 w-5 text-emerald-500" />}
        iconTone="emerald"
        badge={{ label: "LEDGER INTEGRITY", tone: "live" }}
      />
      <Card>
        <CardHeader
          title="Pre-ledger Documents"
          subtitle={
            loading
              ? "Scanning the books…"
              : total === 0
                ? "Ledger is complete — every document is posted"
                : `${total} document${total === 1 ? "" : "s"} missing from the ledger`
          }
          icon={<FileText className="h-4 w-4" />}
          action={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" isLoading={loading} onClick={load}>
                <RefreshCw className="size-3.5" /> Refresh
              </Button>
              <Button variant="primary" size="sm" isLoading={running} onClick={run} disabled={total === 0}>
                <Play className="size-3.5" /> Backfill Now
              </Button>
            </div>
          }
        />
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
            </div>
          ) : total === 0 && !result ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-slate-300 font-semibold">Books are up to date</p>
              <p className="text-xs text-slate-500 mt-1">
                Every in-scope document has a balanced journal entry. Re-run anytime — posting is idempotent.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {Object.entries(byKind).length === 0 ? (
                  <span className="text-xs text-slate-500">No missing documents found.</span>
                ) : (
                  Object.entries(byKind)
                    .sort((a, b) => b[1] - a[1])
                    .map(([kind, n]) => (
                      <div key={kind} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                        <StatusPill variant={KIND_META[kind]?.variant || "info"} label={KIND_META[kind]?.label || kind} />
                        <span className="text-sm font-bold text-white">{n}</span>
                      </div>
                    ))
                )}
              </div>
              {samples.length > 0 && (
                <div className="divide-y divide-white/5 max-h-72 overflow-y-auto rounded-lg border border-white/10">
                  {samples.map((s, i) => (
                    <div key={i} className="px-3 py-2 flex items-center gap-3">
                      <StatusPill variant={KIND_META[s.kind]?.variant || "info"} label={KIND_META[s.kind]?.label || s.kind} />
                      <span className="font-mono text-xs text-slate-300 shrink-0">{s.docNumber}</span>
                      <span className="text-xs text-slate-500 truncate">{s.memo}</span>
                    </div>
                  ))}
                  {(total ?? 0) > samples.length && (
                    <div className="px-3 py-2 text-xs text-slate-500">
                      …and {(total ?? 0) - samples.length} more
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {result && (
            <div className={`mt-4 px-4 py-3 rounded-lg border text-sm ${result.failed.length ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
              {result.failed.length ? (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {result.posted} posted · {result.skipped} already present · {result.failed.length} failed
                    </p>
                    <ul className="text-xs mt-1 space-y-0.5">
                      {result.failed.map((f: any, i: number) => (
                        <li key={i}>— {f.kind} {f.docNumber}: {f.error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>
                    Backfill complete — {result.posted} posted, {result.skipped} already present, 0 failed.
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
