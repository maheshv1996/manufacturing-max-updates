"use client";

import { useEffect, useMemo, useState } from "react";
import { Truck, Plus, Pencil, Search, X } from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";
import { Card, CardHeader, CardContent, Button, Input, Select, StatusPill } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";

interface Vehicle {
  id: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
  type: string;
  year: number | null;
  fuelType: string | null;
  capacity: string | null;
  assignedDriver: string | null;
  rcExpiryDate: string | null;
  insuranceExpiryDate: string | null;
  fitnessExpiryDate: string | null;
  permitExpiryDate: string | null;
  status: "ACTIVE" | "IN_SERVICE" | "OUT_OF_SERVICE" | "SOLD";
  notes: string | null;
  rc?: string;
  insurance?: string;
  fitness?: string;
  permit?: string;
  nextExpiry?: string | null;
}

const EXPIRY_META: { flag: "rc" | "insurance" | "fitness" | "permit"; label: string; dateKey: "rcExpiryDate" | "insuranceExpiryDate" | "fitnessExpiryDate" | "permitExpiryDate" }[] = [
  { flag: "rc", label: "RC", dateKey: "rcExpiryDate" },
  { flag: "insurance", label: "Insurance", dateKey: "insuranceExpiryDate" },
  { flag: "fitness", label: "Fitness", dateKey: "fitnessExpiryDate" },
  { flag: "permit", label: "Permit", dateKey: "permitExpiryDate" },
];

interface VehicleForm {
  registrationNumber: string;
  make: string;
  model: string;
  type: string;
  year: string;
  fuelType: string;
  capacity: string;
  assignedDriver: string;
  rcExpiryDate: string;
  insuranceExpiryDate: string;
  fitnessExpiryDate: string;
  permitExpiryDate: string;
  notes: string;
}

const toDate = (v: string | null) => (v ? String(v).slice(0, 10) : "");

const EMPTY: VehicleForm = {
  registrationNumber: "",
  make: "",
  model: "",
  type: "FOUR_WHEELER",
  year: "",
  fuelType: "",
  capacity: "",
  assignedDriver: "",
  rcExpiryDate: "",
  insuranceExpiryDate: "",
  fitnessExpiryDate: "",
  permitExpiryDate: "",
  notes: "",
};

const pillFor = (flag: string | undefined) => {
  if (flag === "EXPIRED") return <StatusPill variant="danger" label="EXPIRED" />;
  if (flag === "EXPIRING") return <StatusPill variant="warning" label="≤60d" />;
  if (flag === "OK") return <StatusPill variant="success" label="OK" />;
  return <span className="text-xs text-slate-600">—</span>;
};

export default function VehiclesClient() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, flagged: 0, expired: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleForm>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/supply/vehicles")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setVehicles(d.vehicles);
          setStats(d.stats);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) =>
      [v.registrationNumber, v.make, v.model, v.assignedDriver, v.type]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q)),
    );
  }, [vehicles, query]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({
      registrationNumber: v.registrationNumber,
      make: v.make || "",
      model: v.model || "",
      type: v.type,
      year: v.year ? String(v.year) : "",
      fuelType: v.fuelType || "",
      capacity: v.capacity || "",
      assignedDriver: v.assignedDriver || "",
      rcExpiryDate: toDate(v.rcExpiryDate),
      insuranceExpiryDate: toDate(v.insuranceExpiryDate),
      fitnessExpiryDate: toDate(v.fitnessExpiryDate),
      permitExpiryDate: toDate(v.permitExpiryDate),
      notes: v.notes || "",
    });
    setModalOpen(true);
  };

  const setField = (k: keyof VehicleForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.registrationNumber.trim()) {
      toast.error("Registration number is required");
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/supply/vehicles/${editing.id}` : "/api/supply/vehicles";
      const method = editing ? "PATCH" : "POST";
      const payload: any = { ...form };
      if (editing) delete payload.registrationNumber; // identity key — immutable
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        toast.error(d.error || "Failed to save vehicle");
        return;
      }
      soundFx.playSuccess();
      toast.success(editing ? "Vehicle updated" : `${form.registrationNumber} registered`);
      setModalOpen(false);
      load();
    } catch {
      toast.error("Failed to save vehicle");
    } finally {
      setSaving(false);
    }
  };

  const expiredCount = useMemo(() => stats.expired, [stats]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicle Register"
        description="Company fleet master — registration, driver assignment and the four compliance expiries (RC, insurance, fitness, permit) with 60-day expiring alerts so nothing lapses on the road."
        icon={<Truck className="h-5 w-5 text-amber-500" />}
        iconTone="amber"
        badge={{ label: "FLEET", tone: "new" }}
      >
        <Button variant="primary" onClick={openCreate}>
          <Plus className="size-4" /> Register Vehicle
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Fleet Size</p>
          <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Active</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{stats.active}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Expiring Soon</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{stats.flagged}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">documents ≤60 days</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Expired</p>
          <p className="text-2xl font-black text-rose-400 mt-1">{expiredCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">do not run these vehicles</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Fleet Register"
          subtitle={`${filtered.length} vehicles · expiry status computed live`}
          icon={<Truck className="h-4 w-4" />}
          action={
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reg, make, driver…"
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
                  <th className="px-4 py-3 font-semibold">Vehicle</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Driver</th>
                  <th className="px-4 py-3 font-semibold">RC</th>
                  <th className="px-4 py-3 font-semibold">Insurance</th>
                  <th className="px-4 py-3 font-semibold">Fitness</th>
                  <th className="px-4 py-3 font-semibold">Permit</th>
                  <th className="px-4 py-3 font-semibold">Next Due</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-400">Loading fleet register…</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-400">No vehicles registered yet.</td>
                  </tr>
                ) : (
                  filtered.map((v) => (
                    <tr key={v.id} className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${stats.expired && [v.rc, v.insurance, v.fitness, v.permit].includes("EXPIRED") ? "bg-rose-500/[0.04]" : ""}`}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-white font-mono">{v.registrationNumber}</p>
                        <p className="text-xs text-slate-500">
                          {[v.make, v.model].filter(Boolean).join(" ")}
                          {v.year ? ` (${v.year})` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">{v.type.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2.5 text-slate-300">{v.assignedDriver || "—"}</td>
                      {EXPIRY_META.map(({ flag, label, dateKey }) => (
                        <td key={flag} className="px-4 py-2.5" title={label}>
                          <div className="flex flex-col items-start gap-0.5">
                            {pillFor(v[flag])}
                            <span className="text-[10px] text-slate-600">{v[dateKey] ? toDate(v[dateKey]) : ""}</span>
                          </div>
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-slate-300">{v.nextExpiry ? toDate(v.nextExpiry) : "—"}</td>
                      <td className="px-4 py-2.5">
                        <StatusPill
                          variant={v.status === "ACTIVE" || v.status === "IN_SERVICE" ? "success" : v.status === "OUT_OF_SERVICE" ? "warning" : "neutral"}
                          label={v.status.replace(/_/g, " ")}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end">
                          <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(v)}>
                            <Pencil className="size-4" />
                          </Button>
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h3 className="font-semibold text-white">{editing ? "Edit Vehicle" : "Register Vehicle"}</h3>
                <p className="text-xs text-slate-400">{editing ? `Updating ${editing.registrationNumber}` : "Add to the company fleet register"}</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 grid sm:grid-cols-2 gap-4">
              <Input label="Registration Number *" value={form.registrationNumber} onChange={setField("registrationNumber")} disabled={!!editing} placeholder="KA 01 AB 1234" />
              <Input label="Make" value={form.make} onChange={setField("make")} placeholder="e.g. Tata Motors" />
              <Input label="Model" value={form.model} onChange={setField("model")} placeholder="e.g. Ace Gold" />
              <Select label="Type" value={form.type} onChange={setField("type")}>
                {["TWO_WHEELER", "FOUR_WHEELER", "CAR", "VAN", "TRUCK", "BUS", "FORKLIFT", "OTHER"].map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </Select>
              <Input label="Year" type="number" value={form.year} onChange={setField("year")} placeholder="2021" />
              <Input label="Fuel" value={form.fuelType} onChange={setField("fuelType")} placeholder="Diesel / CNG / Electric" />
              <Input label="Capacity / Load" value={form.capacity} onChange={setField("capacity")} placeholder="e.g. 750 kg" />
              <Input label="Assigned Driver" value={form.assignedDriver} onChange={setField("assignedDriver")} placeholder="e.g. Venkatesh" />
              <Input label="RC Expiry" type="date" value={form.rcExpiryDate} onChange={setField("rcExpiryDate")} />
              <Input label="Insurance Expiry" type="date" value={form.insuranceExpiryDate} onChange={setField("insuranceExpiryDate")} />
              <Input label="Fitness Expiry" type="date" value={form.fitnessExpiryDate} onChange={setField("fitnessExpiryDate")} />
              <Input label="Permit Expiry" type="date" value={form.permitExpiryDate} onChange={setField("permitExpiryDate")} />
              <div className="sm:col-span-2">
                <Input label="Notes" value={form.notes} onChange={setField("notes")} placeholder="Hypothecation, route permit zones, condition notes…" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="success" onClick={handleSave} isLoading={saving}>
                {editing ? "Save Changes" : "Register Vehicle"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
