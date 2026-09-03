"use client";

import { useEffect, useMemo, useState } from "react";
import { DoorOpen, Plus, LogOut, Search, X, Clock, Phone } from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";
import { Card, CardHeader, CardContent, Button, Input, StatusPill } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";

interface Visitor {
  id: string;
  visitorName: string;
  company: string | null;
  phone: string | null;
  purpose: string | null;
  hostName: string | null;
  vehicleNumber: string | null;
  idProofType: string | null;
  idProofNumber: string | null;
  badgeNumber: string | null;
  checkInAt: string;
  checkOutAt: string | null;
  status: "EXPECTED" | "IN_SITE" | "CHECKED_OUT";
  notes: string | null;
  createdBy: string | null;
}

interface VisitorForm {
  visitorName: string;
  company: string;
  phone: string;
  hostName: string;
  purpose: string;
  vehicleNumber: string;
  idProofType: string;
  idProofNumber: string;
}

const EMPTY: VisitorForm = {
  visitorName: "",
  company: "",
  phone: "",
  hostName: "",
  purpose: "",
  vehicleNumber: "",
  idProofType: "",
  idProofNumber: "",
};

const fmtTime = (d: string | null) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

function duration(checkIn: string, checkOut: string | null) {
  const end = checkOut ? new Date(checkOut).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - new Date(checkIn).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

export default function VisitorsClient() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [stats, setStats] = useState({ total: 0, inSite: 0, today: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<VisitorForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    fetch("/api/people/visitors")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setVisitors(d.visitors);
          setStats(d.stats);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visitors;
    return visitors.filter((v) =>
      [v.visitorName, v.company, v.hostName, v.purpose, v.phone, v.vehicleNumber]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q)),
    );
  }, [visitors, query]);

  const inSite = visitors.filter((v) => v.status === "IN_SITE");

  const setField = (k: keyof VisitorForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleCheckIn = async () => {
    if (!form.visitorName.trim()) {
      toast.error("Visitor name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/people/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        toast.error(d.error || "Check-in failed");
        return;
      }
      soundFx.playSuccess();
      toast.success(`${form.visitorName} checked in`);
      setFormOpen(false);
      setForm(EMPTY);
      load();
    } catch {
      toast.error("Check-in failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckout = async (v: Visitor) => {
    setBusyId(v.id);
    try {
      const res = await fetch(`/api/people/visitors/${v.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout" }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        toast.error(d.error || "Check-out failed");
        return;
      }
      soundFx.playSuccess();
      toast.success(`${v.visitorName} checked out`);
      load();
    } catch {
      toast.error("Check-out failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visitor Log"
        description="Front-desk / gate register — who is on site, who they are visiting, when they checked in, and security proof captured for the statutory visitor book."
        icon={<DoorOpen className="h-5 w-5 text-indigo-500" />}
        iconTone="indigo"
        badge={{ label: "GATE", tone: "new" }}
      >
        <Button variant="primary" onClick={() => setFormOpen(true)}>
          <Plus className="size-4" /> Check-In Visitor
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">On Site Now</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{stats.inSite}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Visits Today</p>
          <p className="text-2xl font-black text-white mt-1">{stats.today}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Recent Records</p>
          <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Hosts Awaiting</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{inSite.length}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">visitors to collect</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Register"
          subtitle={`${filtered.length} visits · live gate feed`}
          icon={<DoorOpen className="h-4 w-4" />}
          action={
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, company, host…"
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
                  <th className="px-4 py-3 font-semibold">Visitor</th>
                  <th className="px-4 py-3 font-semibold">Visiting</th>
                  <th className="px-4 py-3 font-semibold">Purpose</th>
                  <th className="px-4 py-3 font-semibold">ID Proof</th>
                  <th className="px-4 py-3 font-semibold">Check-In</th>
                  <th className="px-4 py-3 font-semibold">Duration</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">Loading visitor log…</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">No visits recorded yet.</td>
                  </tr>
                ) : (
                  filtered.map((v) => (
                    <tr key={v.id} className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${v.status === "IN_SITE" ? "bg-emerald-500/[0.04]" : ""}`}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-white">{v.visitorName}</p>
                        <p className="text-xs text-slate-500">
                          {v.company || "Individual"}
                          {v.vehicleNumber ? ` · ${v.vehicleNumber}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">
                        {v.hostName || "—"}
                        {v.phone && (
                          <span className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <Phone className="size-3" /> {v.phone}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-300 max-w-[200px]">
                        <span className="block truncate">{v.purpose || "—"}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">
                        {v.idProofType ? (
                          <span className="font-mono text-xs">
                            {v.idProofType}: {v.idProofNumber || "—"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 text-slate-500" /> {fmtTime(v.checkInAt)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">{duration(v.checkInAt, v.checkOutAt)}</td>
                      <td className="px-4 py-2.5">
                        <StatusPill
                          variant={v.status === "IN_SITE" ? "success" : v.status === "EXPECTED" ? "warning" : "neutral"}
                          label={v.status.replace(/_/g, " ")}
                          dot={v.status === "IN_SITE"}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end">
                          {v.status === "IN_SITE" ? (
                            <Button variant="ghost" size="sm" isLoading={busyId === v.id} onClick={() => handleCheckout(v)}>
                              <LogOut className="size-3.5 mr-1" /> Check Out
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-600">{v.checkOutAt ? "Signed out" : ""}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setFormOpen(false)}>
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h3 className="font-semibold text-white">Check-In Visitor</h3>
                <p className="text-xs text-slate-400">Front-desk entry — logged against the gate register</p>
              </div>
              <button onClick={() => setFormOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 grid sm:grid-cols-2 gap-4">
              <Input label="Visitor Name *" value={form.visitorName} onChange={setField("visitorName")} placeholder="e.g. Amit Sharma" />
              <Input label="Company" value={form.company} onChange={setField("company")} placeholder="e.g. Acme Tools Pvt Ltd" />
              <Input label="Phone" value={form.phone} onChange={setField("phone")} placeholder="+91 …" />
              <Input label="Host (who are they here to see?)" value={form.hostName} onChange={setField("hostName")} placeholder="e.g. Suresh, QA Manager" />
              <div className="sm:col-span-2">
                <Input label="Purpose" value={form.purpose} onChange={setField("purpose")} placeholder="e.g. Calibration audit of CMM" />
              </div>
              <Input label="Vehicle Number" value={form.vehicleNumber} onChange={setField("vehicleNumber")} placeholder="KA 01 AB 1234 (optional)" />
              <Input label="ID Proof Type" value={form.idProofType} onChange={setField("idProofType")} placeholder="e.g. Driving Licence" />
              <div className="sm:col-span-2">
                <Input label="ID Proof Number" value={form.idProofNumber} onChange={setField("idProofNumber")} placeholder="Capture number for the register" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
              <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button variant="success" onClick={handleCheckIn} isLoading={saving}>
                Check In
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
