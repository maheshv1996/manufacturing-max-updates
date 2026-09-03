"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Plus,
  Layers,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";
import { Card, CardHeader, CardContent, Button, Input, Select, StatusPill } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";

interface GlAccount {
  id: string;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  group: string | null;
  normalBalance: "DEBIT" | "CREDIT";
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expense",
};

const TYPE_TONES: Record<string, "info" | "warning" | "neutral" | "success" | "danger"> = {
  ASSET: "info",
  LIABILITY: "warning",
  EQUITY: "neutral",
  REVENUE: "success",
  EXPENSE: "danger",
};

const GROUP_LABELS: Record<string, string> = {
  CURRENT_ASSET: "Current Asset",
  FIXED_ASSET: "Fixed Asset",
  INTANGIBLE_ASSET: "Intangible Asset",
  CURRENT_LIABILITY: "Current Liability",
  LONG_TERM_LIABILITY: "Long-Term Liability",
  CAPITAL: "Capital",
  RESERVES: "Reserves & Surplus",
  RETAINED_EARNINGS: "Retained Earnings",
  SALES_REVENUE: "Sales Revenue",
  OTHER_REVENUE: "Other Revenue",
  DIRECT_EXPENSE: "Direct Expense",
  OPERATING_EXPENSE: "Operating Expense",
  FINANCE_EXPENSE: "Finance Expense",
  TAX_EXPENSE: "Tax Expense",
};

export default function ChartOfAccountsClient() {
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Create form
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("ASSET");
  const [group, setGroup] = useState("CURRENT_ASSET");
  const [normalBalance, setNormalBalance] = useState("DEBIT");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/finance/gl-accounts")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setAccounts(data.accounts);
          setStats(data.stats?.byType || {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const groupsForType: Record<string, string[]> = {
    ASSET: ["CURRENT_ASSET", "FIXED_ASSET", "INTANGIBLE_ASSET"],
    LIABILITY: ["CURRENT_LIABILITY", "LONG_TERM_LIABILITY"],
    EQUITY: ["CAPITAL", "RESERVES", "RETAINED_EARNINGS"],
    REVENUE: ["SALES_REVENUE", "OTHER_REVENUE"],
    EXPENSE: ["DIRECT_EXPENSE", "OPERATING_EXPENSE", "FINANCE_EXPENSE", "TAX_EXPENSE"],
  };

  const handleTypeChange = (t: string) => {
    setType(t);
    const gs = groupsForType[t] || [];
    setGroup(gs[0] || "");
    setNormalBalance(
      t === "ASSET" || t === "EXPENSE" ? "DEBIT" : "CREDIT",
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) {
      toast.error("Code and name are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/finance/gl-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          type,
          group,
          normalBalance,
          description: description || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to create account");
        return;
      }
      soundFx.playSuccess();
      toast.success(`Account ${data.account.code} ${data.account.name} created`);
      setCode("");
      setName("");
      setDescription("");
      load();
    } catch {
      toast.error("Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts"
        description="The double-entry general ledger core — every journal line posts against these accounts. Standard manufacturing COA is pre-seeded and extensible."
        icon={<BookOpen className="h-5 w-5 text-emerald-500" />}
        iconTone="emerald"
        badge={{ label: "DOUBLE-ENTRY GL", tone: "new" }}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Total Accounts</p>
          <p className="text-2xl font-black text-white mt-1">{accounts.length}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Active</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">
            {accounts.filter((a) => a.isActive).length}
          </p>
        </Card>
        {(["ASSET", "LIABILITY", "EQUITY", "REVENUE"] as const).map((t) => (
          <Card key={t} className="!p-4">
            <p className="text-xs text-slate-400 font-medium">{TYPE_LABELS[t]}s</p>
            <p className="text-2xl font-black text-white mt-1">{stats[t] || 0}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Create */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader
            title="New Account"
            subtitle="Add a new GL account to the chart"
            icon={<Plus className="h-4 w-4" />}
          />
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                label="Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 1075"
                description="Numeric, unique — e.g. 1010, 5010"
              />
              <Input
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Spare Parts Inventory"
              />
              <Select label="Type" value={type} onChange={(e) => handleTypeChange(e.target.value)}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
              <Select label="Group" value={group} onChange={(e) => setGroup(e.target.value)}>
                {groupsForType[type]?.map((g) => (
                  <option key={g} value={g}>{GROUP_LABELS[g]}</option>
                ))}
              </Select>
              <Select
                label="Normal Balance"
                value={normalBalance}
                onChange={(e) => setNormalBalance(e.target.value)}
              >
                <option value="DEBIT">Debit</option>
                <option value="CREDIT">Credit</option>
              </Select>
              <Input
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this account tracks"
              />
              <Button type="submit" variant="success" isLoading={saving} className="w-full">
                <Plus className="size-4" /> Create Account
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Chart of Accounts"
            subtitle={`${accounts.length} accounts · sorted by code`}
            icon={<Layers className="h-4 w-4" />}
          />
          <CardContent className="!p-0">
            <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-xl">
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <th className="px-4 py-3 font-semibold">Code</th>
                    <th className="px-4 py-3 font-semibold">Account</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Group</th>
                    <th className="px-4 py-3 font-semibold">Normal</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        Loading chart of accounts…
                      </td>
                    </tr>
                  ) : (
                    accounts.map((a) => (
                      <tr
                        key={a.id}
                        className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="px-4 py-2.5 font-mono text-slate-300">{a.code}</td>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-white">{a.name}</p>
                          {a.description && (
                            <p className="text-xs text-slate-500 truncate max-w-[260px]">{a.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusPill variant={TYPE_TONES[a.type] || "neutral"} label={TYPE_LABELS[a.type]} />
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">
                          {a.group ? GROUP_LABELS[a.group] || a.group : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">{a.normalBalance}</td>
                        <td className="px-4 py-2.5">
                          {a.isActive ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                              <CheckCircle2 className="size-3.5" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-500 text-xs font-semibold">
                              <Circle className="size-3.5" /> Inactive
                            </span>
                          )}
                          {a.isSystem && (
                            <span className="ml-1.5 text-[10px] text-slate-500 border border-white/10 rounded-full px-1.5 py-0.5">
                              SYSTEM
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}