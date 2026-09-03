"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Plus, Pencil, Search, X, Ban } from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";
import { Card, CardHeader, CardContent, Button, Input, Select, StatusPill } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";

interface Policy {
  id: string;
  policyNumber: string;
  insurer: string | null;
  policyType: string;
  coveredAsset: string | null;
  sumInsured: number;
  premium: number;
  premiumFrequency: string;
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  status: "ACTIVE" | "EXPIRING" | "EXPIRED" | "CANCELLED";
  notes: string | null;
  effectiveStatus?: string;
}

const POLICY_TYPES = ["ASSET", "VEHICLE", "FIRE", "LIABILITY", "GROUP_HEALTH", "GROUP_LIFE", "KEYMAN", "MARINE", "OTHER"];
const FREQUENCIES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY", "ONE_TIME"];

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const toDate = (v: string | null) => (v ? String(v).slice(0, 10) : "");
const fmtDate = (v: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

interface PolicyForm {
  policyNumber: string;
  insurer: string;
  policyType: string;
  coveredAsset: string;
  sumInsured: string;
  premium: string;
  premiumFrequency: string;
  startDate: string;
  endDate: string;
  renewalDate: string;
  notes: string;
}

const EMPTY: PolicyForm = {
  policyNumber: "",
  insurer: "",
  policyType: "OTHER",
  coveredAsset: "",
  sumInsured: "",
  premium: "",
  premiumFrequency: "YEARLY",
  startDate: "",
  endDate: "",
  renewalDate: "",
  notes: "",
};

function effectiveOf(p: Policy): string {
  if (p.effectiveStatus) return p.effectiveStatus;
  if (p.status !== "ACTIVE") return p.status;
  const horizon = p.endDate || p.renewalDate;
  if (!horizon) return "ACTIVE";
  const days = (new Date(horizon).getTime() - Date.now()) / 86400000;
  if (days < 0) return "EXPIRED";
  if (days <= 60) return "EXPIRING";
  return "ACTIVE";
}

export default function InsuranceClient() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [stats, setStats] = useState({ total: 0, expiring: 0, expired: 0, premiumYear: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [form, setForm] = useState<PolicyForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    fetch("/api/finance/insurance")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setPolicies(d.policies);
          setStats(d.stats);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return policies;
    return policies.filter((p) =>
      [p.policyNumber, p.insurer, p.policyType, p.coveredAsset]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q)),
    );
  }, [policies, query]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (p: Policy) => {
    setEditing(p);
    setForm({
      policyNumber: p.policyNumber,
      insurer: p.insurer || "",
      policyType: p.policyType,
      coveredAsset: p.coveredAsset || "",
      sumInsured: p.sumInsured ? String(p.sumInsured) : "",
      premium: p.premium ? String(p.premium) : "",
      premiumFrequency: p.premiumFrequency,
      startDate: toDate(p.startDate),
      endDate: toDate(p.endDate),
      renewalDate: toDate(p.renewalDate),
      notes: p.notes || "",
    });
    setModalOpen(true);
  };

  const setField = (k: keyof PolicyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.policyNumber.trim()) {
      toast.error("Policy number is required");
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/finance/insurance/${editing.id}` : "/api/finance/insurance";
      const method = editing ? "PATCH" : "POST";
      const payload: any = { ...form };
      if (editing) delete payload.policyNumber; // identity key — immutable
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        toast.error(d.error || "Failed to save policy");
        return;
      }
      soundFx.playSuccess();
      toast.success(editing ? "Policy updated" : `Policy ${form.policyNumber} added`);
      setModalOpen(false);
      load();
    } catch {
      toast.error("Failed to save policy");
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (p: Policy, action: "cancel" | "activate") => {
    if (action === "cancel" && !window.confirm(`Cancel policy ${p.policyNumber}? The cover ends and the register will stop counting it as active.`)) return;
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/finance/insurance/${p.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        toast.error(d.error || "Action failed");
        return;
      }
      soundFx.playSuccess();
      toast.success(action === "cancel" ? "Policy cancelled" : "Policy activated");
      load();
    } catch {
      toast.error("Action failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insurance Register"
        description="Every policy the company carries — asset, vehicle, fire, liability, group health & life, keyman, marine — with sum insured, premium outlay and renewal tracking."
        icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />}
        iconTone="emerald"
        badge={{ label: "RISK COVER", tone: "new" }}
      >
        <Button variant="primary" onClick={openCreate}>
          <Plus className="size-4" /> Add Policy
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Policies</p>
          <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Active Cover</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{policies.filter((p) => effectiveOf(p) === "ACTIVE").length}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Expiring Soon</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{stats.expiring}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">renewal ≤60 days</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Annual Premium</p>
          <p className="text-2xl font-black text-white mt-1">{inr(stats.premiumYear)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">active policies, normalised</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Policy Register"
          subtitle={`${filtered.length} policies · renewal status computed live`}
          icon={<ShieldCheck className="h-4 w-4" />}
          action={
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search policy, insurer, asset…"
                className="w-64 bg-slate-900/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          }
        />
        <CardContent className="!p-0">
          <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-xl">
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-white/10">
                  <th className="px-4 py-3 font-semibold">Policy</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Covered Asset</th>
                  <th className="px-4 py-3 font-semibold">Sum Insured</th>
                  <th className="px-4 py-3 font-semibold">Premium</th>
                  <th className="px-4 py-3 font-semibold">Cover Window</th>
                  <th className="px-4 py-3 font-semibold">Renewal</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400">Loading policy register…</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400">No policies on file yet.</td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const eff = effectiveOf(p);
                    return (
                      <tr key={p.id} className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${eff === "EXPIRED" ? "bg-rose-500/[0.04]" : eff === "EXPIRING" ? "bg-amber-500/[0.03]" : ""}`}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-white font-mono">{p.policyNumber}</p>
                          <p className="text-xs text-slate-500">{p.insurer || "—"}</p>
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">{p.policyType.replace(/_/g, " ")}</td>
                        <td className="px-4 py-2.5 text-slate-300 max-w-[180px]">
                          <span className="block truncate">{p.coveredAsset || "—"}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">{inr(p.sumInsured)}</td>
                        <td className="px-4 py-2.5 text-slate-300">
                          {inr(p.premium)}
                          <span className="text-xs text-slate-500 block">{p.premiumFrequency.replace(/_/g, " ")}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">
                          {fmtDate(p.startDate)} → {fmtDate(p.endDate)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">{fmtDate(p.renewalDate)}</td>
                        <td className="px-4 py-2.5">
                          <StatusPill
                            variant={eff === "ACTIVE" ? "success" : eff === "EXPIRING" ? "warning" : eff === "EXPIRED" ? "danger" : "neutral"}
                            label={eff}
                            dot={eff === "ACTIVE"}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(p)}>
                              <Pencil className="size-4" />
                            </Button>
                            {p.status === "ACTIVE" ? (
                              <Button variant="ghost" size="icon" title="Cancel policy" isLoading={busyId === p.id} onClick={() => handleAction(p, "cancel")}>
                                <Ban className="size-4 text-rose-400" />
                              </Button>
                            ) : p.status === "CANCELLED" ? (
                              <Button variant="ghost" size="icon" title="Reactivate" isLoading={busyId === p.id} onClick={() => handleAction(p, "activate")}>
                                <ShieldCheck className="size-4 text-emerald-400" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h3 className="font-semibold text-white">{editing ? "Edit Policy" : "Add Policy"}</h3>
                <p className="text-xs text-slate-400">{editing ? `Updating ${editing.policyNumber}` : "Register an insurance policy"}</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 grid sm:grid-cols-2 gap-4">
              <Input label="Policy Number *" value={form.policyNumber} onChange={setField("policyNumber")} disabled={!!editing} placeholder="e.g. 1234/567890/00" />
              <Input label="Insurer" value={form.insurer} onChange={setField("insurer")} placeholder="e.g. New India Assurance" />
              <Select label="Policy Type" value={form.policyType} onChange={setField("policyType")}>
                {POLICY_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </Select>
              <Input label="Covered Asset" value={form.coveredAsset} onChange={setField("coveredAsset")} placeholder="Vehicle reg / asset tag / employee group" />
              <Input label="Sum Insured (₹)" type="number" value={form.sumInsured} onChange={setField("sumInsured")} placeholder="5000000" />
              <Input label="Premium (₹)" type="number" value={form.premium} onChange={setField("premium")} placeholder="25000" />
              <Select label="Premium Frequency" value={form.premiumFrequency} onChange={setField("premiumFrequency")}>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
                ))}
              </Select>
              <div className="sm:col-span-2 grid grid-cols-3 gap-3">
                <Input label="Start" type="date" value={form.startDate} onChange={setField("startDate")} />
                <Input label="End" type="date" value={form.endDate} onChange={setField("endDate")} />
                <Input label="Renewal" type="date" value={form.renewalDate} onChange={setField("renewalDate")} />
              </div>
              <div className="sm:col-span-2">
                <Input label="Notes" value={form.notes} onChange={setField("notes")} placeholder="Claims history, brokers, riders…" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="success" onClick={handleSave} isLoading={saving}>
                {editing ? "Save Changes" : "Add Policy"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
