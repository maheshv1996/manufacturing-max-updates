"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ShieldAlert,
  Plus,
  RefreshCw,
  Loader2,
  CheckCircle2,
  CalendarClock,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { Card, CardHeader, CardContent, Button, StatusPill, Input, Select } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";
import {
  CATEGORY_LABEL,
  computeRisk,
  LEVEL_TONE,
  RISK_CATEGORIES,
} from "@/lib/riskRegister";

interface Risk {
  id: string;
  riskCode: string;
  title: string;
  category: string;
  description: string | null;
  likelihood: number;
  impact: number;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  owner: string | null;
  mitigation: string | null;
  contingency: string | null;
  status: string;
  reviewDueAt: string | null;
  lastReviewedAt: string | null;
  createdBy: string;
  daysLeft: number;
  reviewStatus: "VALID" | "DUE" | "OVERDUE";
}

function FieldTextarea({ label, value, onChange, rows = 2, placeholder }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <div className="w-full flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-200 select-none">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-white/20 resize-y"
      />
    </div>
  );
}

const EMPTY_FORM = {
  title: "",
  category: "OPERATIONAL",
  description: "",
  likelihood: 3,
  impact: 3,
  owner: "",
  mitigation: "",
  contingency: "",
};

export default function RiskRegisterClient() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, critical: 0, high: 0, reviewOverdue: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filter, setFilter] = useState("ALL");

  const load = async () => {
    try {
      const res = await fetch("/api/risk-register");
      if (res.ok) {
        const d = await res.json();
        setRisks(d.risks || []);
        setStats(d.stats || {});
      } else {
        toast.error("Failed to load risk register");
      }
    } catch {
      toast.error("Failed to load risk register");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = useMemo(() => computeRisk(form.likelihood, form.impact), [form.likelihood, form.impact]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/risk-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-risk", data: form }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Create failed");
        return;
      }
      toast.success(`${d.record.riskCode} registered — ${d.record.riskLevel}`);
      setForm(EMPTY_FORM);
      setFormOpen(false);
      await load();
    } catch {
      toast.error("Create failed");
    } finally {
      setSaving(false);
    }
  };

  const act = async (action: string, id: string, okMsg: string) => {
    try {
      const res = await fetch("/api/risk-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: { id } }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Action failed");
        return;
      }
      toast.success(okMsg);
      await load();
    } catch {
      toast.error("Action failed");
    }
  };

  const filtered = risks.filter((r) => filter === "ALL" || r.status === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Register"
        description="Operational and strategic risks with likelihood × impact scoring, accountable owners, mitigation plans and a quarterly review cadence. HIGH / CRITICAL risks and overdue reviews flag the compliance digest and the MRM agenda automatically."
        icon={<ShieldAlert className="h-5 w-5 text-rose-500" />}
        iconTone="rose"
        badge={{ label: "RISK-BASED THINKING · ISO 9001 6.1", tone: "live" }}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Open risks", value: stats.open, cls: "text-white" },
          { label: "CRITICAL", value: stats.critical, cls: "text-rose-400" },
          { label: "HIGH", value: stats.high, cls: "text-amber-400" },
          { label: "Reviews overdue", value: stats.reviewOverdue, cls: "text-orange-400" },
          { label: "All time", value: stats.total, cls: "text-slate-300" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className={`text-2xl font-black tabular-nums ${s.cls}`}>{s.value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Risk List"
          subtitle={`${filtered.length} risk${filtered.length === 1 ? "" : "s"} · ordered by severity`}
          icon={<ShieldAlert className="h-4 w-4" />}
          action={
            <div className="flex items-center gap-2">
              <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-40">
                <option value="ALL">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="MITIGATED">Mitigated</option>
                <option value="CLOSED">Closed</option>
              </Select>
              <Button variant="ghost" size="sm" isLoading={loading} onClick={load}>
                <RefreshCw className="size-3.5" /> Refresh
              </Button>
              <Button variant="primary" size="sm" onClick={() => setFormOpen((v) => !v)}>
                <Plus className="size-3.5" /> Register risk
              </Button>
            </div>
          }
        />
        <CardContent>
          {formOpen && (
            <div className="mb-5 grid md:grid-cols-2 gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="md:col-span-2">
                <Input label="Risk title *" value={form.title} onChange={set("title")} placeholder="e.g. Single-source supplier concentration for critical raw material" />
              </div>
              <div>
                <Select label="Category" value={form.category} onChange={set("category")}>
                  {RISK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Input label="Owner (name / role)" value={form.owner} onChange={set("owner")} placeholder="e.g. SCM Head" />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-medium">Likelihood (1–5)</label>
                <input type="range" min={1} max={5} value={form.likelihood} onChange={(e) => setForm((f) => ({ ...f, likelihood: Number(e.target.value) }))} className="w-full mt-2 accent-rose-500" />
                <p className="text-[11px] text-slate-500 mt-1">Score {form.likelihood}</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-medium">Impact (1–5)</label>
                <input type="range" min={1} max={5} value={form.impact} onChange={(e) => setForm((f) => ({ ...f, impact: Number(e.target.value) }))} className="w-full mt-2 accent-rose-500" />
                <p className="text-[11px] text-slate-500 mt-1">Score {form.impact}</p>
              </div>
              <div className="md:col-span-2 flex items-center gap-3 rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2">
                <StatusPill variant={LEVEL_TONE[live.level]} label={live.level} />
                <span className="text-xs text-slate-400">
                  Risk score <b className="text-white font-mono">{live.score}</b> = {form.likelihood} × {form.impact} · review due in 90 days
                </span>
              </div>
              <FieldTextarea label="Mitigation plan" value={form.mitigation} onChange={(v) => setForm((f) => ({ ...f, mitigation: v }))} placeholder="What reduces likelihood or impact?" />
              <FieldTextarea label="Contingency (if it happens)" value={form.contingency} onChange={(v) => setForm((f) => ({ ...f, contingency: v }))} placeholder="What do we do when it materialises?" />
              <FieldTextarea label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)}>Cancel</Button>
                <Button variant="primary" size="sm" isLoading={saving} onClick={create}>
                  <Plus className="size-3.5" /> Register
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-slate-300 font-semibold">No risks registered</p>
              <p className="text-xs text-slate-500 mt-1">Register the first risk to start risk-based thinking.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((r) => (
                <div key={r.id} className="py-3 flex items-start gap-3">
                  <div className="w-16 shrink-0">
                    <StatusPill variant={LEVEL_TONE[r.riskLevel]} label={r.riskLevel} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {r.riskCode} · {r.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {CATEGORY_LABEL[r.category] || r.category}
                      {r.owner ? ` · owner: ${r.owner}` : ""} · L{r.likelihood} × I{r.impact} ={" "}
                      <span className="font-mono">{r.riskScore}</span>
                    </p>
                    {r.mitigation && (
                      <p className="text-[11px] text-slate-400 mt-1 truncate">
                        Mitigation: {r.mitigation}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      {r.reviewStatus === "OVERDUE" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-400">
                          <CalendarClock className="size-3" /> REVIEW OVERDUE
                        </span>
                      ) : r.reviewStatus === "DUE" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                          <CalendarClock className="size-3" /> review due in {r.daysLeft}d
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-600">
                          <CalendarClock className="size-3" /> review {r.reviewDueAt ? new Date(r.reviewDueAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                        </span>
                      )}
                      <StatusPill
                        variant={r.status === "CLOSED" ? "neutral" : r.status === "MITIGATED" ? "success" : "info"}
                        label={r.status}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.status !== "CLOSED" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => act("review-risk", r.id, `${r.riskCode} reviewed — next review +90d`)}
                        >
                          <CheckCircle2 className="size-3.5" /> Review
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => act("close-risk", r.id, `${r.riskCode} closed`)}
                        >
                          Close
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}