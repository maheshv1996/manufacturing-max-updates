"use client";

import { useEffect, useState } from "react";
import { CalendarRange, Plus, Lock, Unlock } from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";
import { Card, CardHeader, CardContent, Button, Input, StatusPill } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";

interface FiscalPeriod {
  id: string;
  code: string;
  label: string | null;
  startDate: string;
  endDate: string;
  status: "OPEN" | "CLOSED";
  closedBy: string | null;
  closedAt: string | null;
  createdAt: string;
}

export default function PeriodsClient() {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/finance/periods")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setPeriods(data.periods);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !startDate || !endDate) {
      toast.error("Code, start and end dates are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/finance/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, label: label || null, startDate, endDate }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to create period");
        return;
      }
      soundFx.playSuccess();
      toast.success(`Period ${data.period.code} opened`);
      setCode("");
      setLabel("");
      setEndDate("");
      load();
    } catch {
      toast.error("Failed to create period");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (p: FiscalPeriod) => {
    const closing = p.status === "OPEN";
    if (closing && !window.confirm(`Close period ${p.code}? New GL entries can still post — the period is a control marker.`)) return;
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/finance/periods/${p.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: closing ? "close" : "open" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to update period");
        return;
      }
      soundFx.playSuccess();
      toast.success(`Period ${data.period.code} ${closing ? "closed" : "reopened"}`);
      load();
    } catch {
      toast.error("Failed to update period");
    } finally {
      setBusyId(null);
    }
  };

  const openCount = periods.filter((p) => p.status === "OPEN").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fiscal Periods"
        description="Define and control accounting periods. Closed periods are marked for reporting — keep one open period for live postings."
        icon={<CalendarRange className="h-5 w-5 text-emerald-500" />}
        iconTone="emerald"
        badge={{ label: `${openCount} OPEN`, tone: openCount > 0 ? "live" : "warn" }}
      />

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="h-fit">
          <CardHeader
            title="Open Period"
            subtitle="Create a new fiscal period"
            icon={<Plus className="h-4 w-4" />}
          />
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                label="Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 2026-04 or FY2026-27"
              />
              <Input
                label="Label (optional)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. April 2026"
              />
              <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              <Button type="submit" variant="success" isLoading={saving} className="w-full">
                <Plus className="size-4" /> Open Period
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader
            title="Period Register"
            subtitle={`${periods.length} periods · newest first`}
            icon={<CalendarRange className="h-4 w-4" />}
          />
          <CardContent className="!p-0">
            {loading ? (
              <p className="px-4 py-10 text-center text-slate-400">Loading fiscal periods…</p>
            ) : periods.length === 0 ? (
              <p className="px-4 py-10 text-center text-slate-400">
                No periods defined — create your first period on the left.
              </p>
            ) : (
              <div className="divide-y divide-white/5">
                {periods.map((p) => (
                  <div key={p.id} className="px-4 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-white">
                        {p.code}{" "}
                        {p.label && <span className="text-slate-400 font-sans">· {p.label}</span>}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(p.startDate).toLocaleDateString("en-IN")} →{" "}
                        {new Date(p.endDate).toLocaleDateString("en-IN")}
                        {p.closedAt
                          ? ` · closed by ${p.closedBy || "—"} on ${new Date(p.closedAt).toLocaleDateString("en-IN")}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusPill
                        variant={p.status === "OPEN" ? "success" : "neutral"}
                        label={p.status}
                        dot
                      />
                      <Button
                        variant={p.status === "OPEN" ? "outline" : "ghost"}
                        size="sm"
                        onClick={() => handleToggle(p)}
                        isLoading={busyId === p.id}
                      >
                        {p.status === "OPEN" ? (
                          <>
                            <Lock className="size-3.5" /> Close
                          </>
                        ) : (
                          <>
                            <Unlock className="size-3.5" /> Reopen
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}