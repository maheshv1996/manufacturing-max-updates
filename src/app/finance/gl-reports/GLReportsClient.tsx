"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Scale,
  Landmark,
  RefreshCw,
  FileText,
} from "lucide-react";
import { Card, CardHeader, CardContent, Button, Input, StatusPill } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";

type ReportType = "trial-balance" | "profit-loss" | "balance-sheet";

const fmt = (n: number) =>
  (n === undefined || n === null ? 0 : n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const money = (n: number) => "₹" + fmt(n);

interface TbRow {
  code: string;
  name: string;
  type: string;
  openingDebit: number;
  openingCredit: number;
  debit: number;
  credit: number;
  closingDebit: number;
  closingCredit: number;
}

interface PnlAccount {
  code: string;
  name: string;
  amount: number;
}
interface PnlSection {
  group: string;
  accounts: PnlAccount[];
  total: number;
}

export default function GLReportsClient() {
  const [type, setType] = useState<ReportType>("trial-balance");
  const [from, setFrom] = useState(() => `${new Date().getFullYear()}-04-01`);
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    const params =
      type === "balance-sheet"
        ? `type=balance-sheet&asOf=${asOf}`
        : `type=${type}&from=${from}&to=${to}`;
    fetch(`/api/finance/reports?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d.report);
        else setError(d.error || "Failed to load report");
      })
      .catch(() => setError("Failed to load report"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [type]);

  const tabs: Array<{ key: ReportType; label: string; icon: React.ReactNode }> = [
    { key: "trial-balance", label: "Trial Balance", icon: <Scale className="size-3.5" /> },
    { key: "profit-loss", label: "Profit & Loss", icon: <BarChart3 className="size-3.5" /> },
    { key: "balance-sheet", label: "Balance Sheet", icon: <Landmark className="size-3.5" /> },
  ];

  const isBalanced =
    type === "trial-balance"
      ? data?.totals?.balanced
      : type === "balance-sheet"
        ? data?.totals?.balanced
        : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="GL Reports"
        description="Audit-grade financial statements computed live from posted journal entries — trial balance, profit & loss, and balance sheet."
        icon={<BarChart3 className="h-5 w-5 text-emerald-500" />}
        iconTone="emerald"
        badge={
          isBalanced === undefined
            ? undefined
            : { label: isBalanced ? "IN BALANCE" : "IMBALANCE!", tone: isBalanced ? "live" : "danger" }
        }
      />

      <Card>
        <CardContent className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex rounded-xl bg-white/[0.04] border border-white/10 p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  type === t.key
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-400 hover:text-white border border-transparent"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {type === "balance-sheet" ? (
            <div className="flex items-end gap-3">
              <Input label="As of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-44" />
              <Button onClick={load} isLoading={loading}>
                <RefreshCw className="size-4" /> Run
              </Button>
            </div>
          ) : (
            <div className="flex items-end gap-3 flex-1 flex-wrap">
              <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
              <Button onClick={load} isLoading={loading}>
                <RefreshCw className="size-4" /> Run
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-rose-500/30">
          <CardContent>
            <p className="text-sm text-rose-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {type === "trial-balance" && data && (
        <Card>
          <CardHeader
            title="Trial Balance"
            subtitle={`${data.from?.slice(0, 10) || "—"} → ${data.to?.slice(0, 10) || "—"} · ${data.rows?.length || 0} accounts`}
            icon={<Scale className="h-4 w-4" />}
            action={
              <StatusPill variant={data.totals?.balanced ? "success" : "danger"} label={data.totals?.balanced ? "IN BALANCE" : "IMBALANCE"} />
            }
          />
          <CardContent className="!p-0">
            <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-xl">
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <th className="px-4 py-3 font-semibold">Account</th>
                    <th className="px-4 py-3 font-semibold text-right">Opening Dr</th>
                    <th className="px-4 py-3 font-semibold text-right">Opening Cr</th>
                    <th className="px-4 py-3 font-semibold text-right">Dr</th>
                    <th className="px-4 py-3 font-semibold text-right">Cr</th>
                    <th className="px-4 py-3 font-semibold text-right">Closing Dr</th>
                    <th className="px-4 py-3 font-semibold text-right">Closing Cr</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r: TbRow) => (
                    <tr key={r.code} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-2">
                        <span className="font-mono text-slate-400">{r.code}</span>{" "}
                        <span className="text-white font-medium">{r.name}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-slate-400">{r.openingDebit ? money(r.openingDebit) : "—"}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-400">{r.openingCredit ? money(r.openingCredit) : "—"}</td>
                      <td className="px-4 py-2 text-right font-mono text-emerald-400">{r.debit ? money(r.debit) : "—"}</td>
                      <td className="px-4 py-2 text-right font-mono text-amber-400">{r.credit ? money(r.credit) : "—"}</td>
                      <td className="px-4 py-2 text-right font-mono text-white font-semibold">{r.closingDebit ? money(r.closingDebit) : "—"}</td>
                      <td className="px-4 py-2 text-right font-mono text-white font-semibold">{r.closingCredit ? money(r.closingCredit) : "—"}</td>
                    </tr>
                  ))}
                  <tr className="sticky bottom-0 bg-slate-900/95 backdrop-blur-xl font-bold text-white">
                    <td className="px-4 py-3">Totals</td>
                    <td colSpan={2} />
                    <td className="px-4 py-3 text-right font-mono text-emerald-400">{money(data.totals.movementDebit)}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400">{money(data.totals.movementCredit)}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(data.totals.closingDebit)}</td>
                    <td className="px-4 py-3 text-right font-mono">{money(data.totals.closingCredit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {type === "profit-loss" && data && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader title="Revenue" subtitle="Income for the period" icon={<BarChart3 className="h-4 w-4" />} />
            <CardContent className="!p-0">
              {renderPnlSections(data.revenue, "text-emerald-400")}
              <div className="px-5 py-3 border-t border-white/10 flex justify-between font-bold text-white">
                <span>Total Revenue</span>
                <span className="font-mono">{money(data.totals.revenue)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Expenses" subtitle="Costs for the period" icon={<FileText className="h-4 w-4" />} />
            <CardContent className="!p-0">
              {renderPnlSections(data.expenses, "text-amber-400")}
              <div className="px-5 py-3 border-t border-white/10 flex justify-between font-bold text-white">
                <span>Total Expenses</span>
                <span className="font-mono">{money(data.totals.expenses)}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2 border-emerald-500/20">
            <CardContent className="flex items-center justify-between">
              <span className="font-semibold text-white">Net Profit / (Loss)</span>
              <span
                className={`font-mono text-xl font-black ${
                  data.totals.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {money(data.totals.netProfit)}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {type === "balance-sheet" && data && (
        <div className="grid lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader title="Assets" subtitle={`As of ${data.asOf?.slice(0, 10) || "—"}`} icon={<Landmark className="h-4 w-4" />} />
            <CardContent className="!p-0">
              {renderSections(data.assets)}
              <div className="px-5 py-3 border-t border-white/10 flex justify-between font-bold text-white">
                <span>Total Assets</span>
                <span className="font-mono">{money(data.totals.assets)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Liabilities" icon={<Landmark className="h-4 w-4" />} />
            <CardContent className="!p-0">
              {renderSections(data.liabilities)}
              <div className="px-5 py-3 border-t border-white/10 flex justify-between font-bold text-white">
                <span>Total Liabilities</span>
                <span className="font-mono">{money(data.totals.liabilities)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Equity" icon={<Landmark className="h-4 w-4" />} />
            <CardContent className="!p-0">
              {renderSections(data.equity)}
              <div className="px-5 py-2.5 border-t border-white/10 flex justify-between text-sm font-semibold text-emerald-400">
                <span>Net Profit (cumulative)</span>
                <span className="font-mono">{money(data.netProfit)}</span>
              </div>
              <div className="px-5 py-3 border-t border-white/10 flex justify-between font-bold text-white">
                <span>Total Liabilities + Equity</span>
                <span className="font-mono">{money(data.totals.liabilitiesPlusEquity)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loading && (
        <p className="text-center text-sm text-slate-400 py-8">Computing report…</p>
      )}
    </div>
  );

  function renderPnlSections(sections: PnlSection[], amountCls: string) {
    if (!sections || sections.length === 0) {
      return <p className="px-5 py-8 text-center text-sm text-slate-500">No activity in this period.</p>;
    }
    return (
      <div className="divide-y divide-white/5">
        {sections.map((s) => (
          <div key={s.group}>
            <p className="px-5 pt-3 text-xs font-bold uppercase tracking-wider text-slate-500">{s.group.replace(/_/g, " ")}</p>
            {s.accounts.map((a) => (
              <div key={a.code} className="px-5 py-1.5 flex justify-between text-sm">
                <span className="text-slate-300">
                  <span className="font-mono text-slate-500">{a.code}</span> {a.name}
                </span>
                <span className={`font-mono ${amountCls}`}>{money(a.amount)}</span>
              </div>
            ))}
            <div className="px-5 py-1.5 flex justify-between text-sm font-semibold text-slate-200">
              <span>Section total</span>
              <span className="font-mono">{money(s.total)}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderSections(rows: Array<{ code: string; name: string; amount: number }>) {
    if (!rows || rows.length === 0) {
      return <p className="px-5 py-8 text-center text-sm text-slate-500">No balances.</p>;
    }
    return (
      <div className="divide-y divide-white/5">
        {rows.map((r) => (
          <div key={r.code} className="px-5 py-2 flex justify-between text-sm">
            <span className="text-slate-300">
              <span className="font-mono text-slate-500">{r.code}</span> {r.name}
            </span>
            <span className="font-mono text-white">{money(r.amount)}</span>
          </div>
        ))}
      </div>
    );
  }
}