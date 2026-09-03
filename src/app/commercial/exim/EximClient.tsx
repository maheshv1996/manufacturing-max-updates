"use client";

import PageHeader from "@/app/components/shared/PageHeader";

import {useCallback, useEffect, useState } from "react";
import {
  Ship,
  Plus,
  Loader2,
  Search,
  Plane,
  Anchor,
  FileSearch,
  MapPin,
  FileCheck2,
  ChevronRight,
  FileText
} from "lucide-react";
import {
  Card,
  Button,
  Input,
  Select,
  StatusPill,
  KpiCard,
} from "@/app/components/ui";

const MODES = ["AIR", "SEA", "ROAD", "RAIL"];
const INCOTERMS = ["EXW", "FOB", "CIF", "CIP", "DAP", "DDP", "OTHER"];
const STATUSES = ["BOOKED", "IN_TRANSIT", "CLEARED", "DELIVERED"];

const DOCS = [
  { key: "docCi", label: "CI" },
  { key: "docPl", label: "PL" },
  { key: "docCoO", label: "CoO" },
  { key: "docBl", label: "BL" },
] as const;

const STEPS = [
  { key: "bookingDate", label: "Booking", icon: FileSearch },
  { key: "sailingDate", label: "Vessel", icon: Anchor },
  { key: "customsClearDate", label: "Customs", icon: FileCheck2 },
  { key: "arrivalDate", label: "Arrival", icon: MapPin },
] as const;

const statusVariant: Record<string, string> = {
  BOOKED: "info",
  IN_TRANSIT: "warning",
  CLEARED: "info",
  DELIVERED: "success",
};

interface Shipment {
  id: string;
  shipmentNumber: string;
  shipmentType: string;
  mode: string;
  incoterm: string;
  port: string;
  invoiceNumber?: string | null;
  customerName?: string | null;
  customsValue: number;
  currency: string;
  shipmentDate: string;
  status: string;
  notes?: string | null;
  vesselName?: string | null;
  voyageNo?: string | null;
  blNumber?: string | null;
  bookingDate?: string | null;
  sailingDate?: string | null;
  customsClearDate?: string | null;
  arrivalDate?: string | null;
  docCi: boolean;
  docPl: boolean;
  docCoO: boolean;
  docBl: boolean;
}

const EMPTY_FORM: Record<string, any> = {
  shipmentNumber: "",
  shipmentType: "EXPORT",
  mode: "AIR",
  incoterm: "FOB",
  port: "",
  invoiceNumber: "",
  customerName: "",
  customsValue: "",
  currency: "USD",
  shipmentDate: "",
  status: "BOOKED",
  notes: "",
};

export default function EximClient() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    inTransit: 0,
    cleared: 0,
    delivered: 0,
    docsComplete: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({ ...EMPTY_FORM });
  const [milestoneShipment, setMilestoneShipment] = useState<Shipment | null>(
    null,
  );
  const [mForm, setMForm] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/exim");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setShipments(json.shipments || []);
      setStats(json.stats || {});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitCreate = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/register/eximShipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", data: form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      setCreateOpen(false);
      setForm({ ...EMPTY_FORM });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openMilestones = (s: Shipment) => {
    setMForm({
      vesselName: s.vesselName || "",
      voyageNo: s.voyageNo || "",
      blNumber: s.blNumber || "",
      bookingDate: s.bookingDate ? s.bookingDate.slice(0, 10) : "",
      sailingDate: s.sailingDate ? s.sailingDate.slice(0, 10) : "",
      customsClearDate: s.customsClearDate
        ? s.customsClearDate.slice(0, 10)
        : "",
      arrivalDate: s.arrivalDate ? s.arrivalDate.slice(0, 10) : "",
      docCi: s.docCi,
      docPl: s.docPl,
      docCoO: s.docCoO,
      docBl: s.docBl,
    });
    setMilestoneShipment(s);
  };

  const saveMilestones = async () => {
    if (!milestoneShipment) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/exim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_milestones",
          id: milestoneShipment.id,
          data: mForm,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setMilestoneShipment(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const advance = async (s: Shipment) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/exim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance_status", id: s.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Advance failed");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const visible = shipments.filter((s) => {
    const q = query.trim().toLowerCase();
    const matchesQ =
      !q ||
      s.shipmentNumber.toLowerCase().includes(q) ||
      (s.port || "").toLowerCase().includes(q) ||
      (s.customerName || "").toLowerCase().includes(q) ||
      (s.invoiceNumber || "").toLowerCase().includes(q);
    const matchesS = statusFilter === "ALL" || s.status === statusFilter;
    return matchesQ && matchesS;
  });

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiCard
          title="Shipments"
          value={stats.total}
          tone="sky"
          icon={<Ship className="h-4 w-4" />}
        />
        <KpiCard
          title="In Transit"
          value={stats.inTransit}
          tone="amber"
          icon={<Plane className="h-4 w-4" />}
        />
        <KpiCard
          title="Cleared"
          value={stats.cleared}
          tone="cyan"
          icon={<FileCheck2 className="h-4 w-4" />}
        />
        <KpiCard
          title="Delivered"
          value={stats.delivered}
          tone="emerald"
          icon={<MapPin className="h-4 w-4" />}
        />
        <KpiCard
          title="Docs Complete"
          value={stats.docsComplete}
          tone="indigo"
          icon={<FileCheck2 className="h-4 w-4" />}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search number, port, customer…"
                className="w-64 pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-40"
            >
              <option value="ALL">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New Shipment
          </Button>
        </div>

        <div className="divide-y divide-slate-800/60">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading
              shipments…
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              No shipments found. Create the first one to start the register.
            </div>
          ) : (
            visible.map((s) => (
              <div key={s.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-100">
                        {s.shipmentNumber}
                      </span>
                      <StatusPill
                        variant={(statusVariant[s.status] as any) || "neutral"}
                        label={s.status}
                        dot
                      />
                      <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-400">
                        {s.shipmentType}
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-300">
                        {s.mode} · {s.incoterm}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400">
                      {s.port}
                      {s.customerName ? ` · ${s.customerName}` : ""}
                      {s.invoiceNumber
                        ? ` · Inv ${s.invoiceNumber}`
                        : ""} ·{" "}
                      {Number(s.customsValue).toLocaleString("en-IN", {
                        maximumFractionDigits: 0,
                      })}{" "}
                      {s.currency} ·{" "}
                      {new Date(s.shipmentDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openMilestones(s)}
                    >
                      Milestones & Docs
                    </Button>
                    {s.status !== "DELIVERED" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => advance(s)}
                        disabled={busy}
                      >
                        Advance <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {STEPS.map((step, i) => {
                    const done = Boolean(s[step.key]);
                    const Icon = step.icon;
                    return (
                      <div key={step.key} className="flex items-center gap-2">
                        <div
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
                            done
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : "border-slate-700 bg-slate-800/60 text-slate-400"
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          {step.label}
                          {done ? (
                            <span className="font-medium">
                              {new Date(
                                s[step.key] as string,
                              ).toLocaleDateString()}
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                        {i < STEPS.length - 1 && (
                          <span
                            className={`h-px w-4 ${
                              s[STEPS[i + 1].key]
                                ? "bg-emerald-500/40"
                                : "bg-slate-700"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                  {s.vesselName && (
                    <span
                      className="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[11px] text-slate-300"
                      title={`Voyage ${s.voyageNo || ""} · BL ${s.blNumber || ""}`}
                    >
                      ⛵ {s.vesselName} {s.voyageNo ? `· V${s.voyageNo}` : ""}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="mr-1 text-[11px] text-slate-500">
                      Documents:
                    </span>
                    {DOCS.map((d) => (
                      <span
                        key={d.key}
                        title={d.label}
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold ${
                          s[d.key]
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-slate-700 bg-slate-800/60 text-slate-500"
                        }`}
                      >
                        {d.label}
                      </span>
                    ))}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {createOpen && (
        <ModalPanel title="New Shipment" onClose={() => setCreateOpen(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Shipment Number *"
              value={form.shipmentNumber}
              onChange={(e) =>
                setForm({ ...form, shipmentNumber: e.target.value })
              }
              placeholder="SHP-EXP-2026-001"
            />
            <Select
              label="Type"
              value={form.shipmentType}
              onChange={(e) =>
                setForm({ ...form, shipmentType: e.target.value })
              }
            >
              <option>EXPORT</option>
              <option>IMPORT</option>
            </Select>
            <Select
              label="Mode"
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value })}
            >
              {MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
            <Select
              label="Incoterm"
              value={form.incoterm}
              onChange={(e) => setForm({ ...form, incoterm: e.target.value })}
            >
              {INCOTERMS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
            <Input
              label="Port / Gateway *"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: e.target.value })}
              placeholder="JNPT, Nhava Sheva"
            />
            <Input
              label="Invoice Reference"
              value={form.invoiceNumber}
              onChange={(e) =>
                setForm({ ...form, invoiceNumber: e.target.value })
              }
            />
            <Input
              label="Customer"
              value={form.customerName}
              onChange={(e) =>
                setForm({ ...form, customerName: e.target.value })
              }
            />
            <Input
              label="Customs Value"
              type="number"
              value={form.customsValue}
              onChange={(e) =>
                setForm({ ...form, customsValue: e.target.value })
              }
            />
            <Input
              label="Currency"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            />
            <Input
              label="Shipment Date"
              type="date"
              value={form.shipmentDate}
              onChange={(e) =>
                setForm({ ...form, shipmentDate: e.target.value })
              }
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
          <Input
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submitCreate}
              disabled={busy || !form.shipmentNumber || !form.port}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}{" "}
              Create Shipment
            </Button>
          </div>
        </ModalPanel>
      )}

      {milestoneShipment && (
        <ModalPanel
          title={`Milestones & Documents — ${milestoneShipment.shipmentNumber}`}
          onClose={() => setMilestoneShipment(null)}
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Booking Date"
              type="date"
              value={mForm.bookingDate}
              onChange={(e) =>
                setMForm({ ...mForm, bookingDate: e.target.value })
              }
            />
            <Input
              label="Sailing Date"
              type="date"
              value={mForm.sailingDate}
              onChange={(e) =>
                setMForm({ ...mForm, sailingDate: e.target.value })
              }
            />
            <Input
              label="Customs Clear Date"
              type="date"
              value={mForm.customsClearDate}
              onChange={(e) =>
                setMForm({ ...mForm, customsClearDate: e.target.value })
              }
            />
            <Input
              label="Arrival Date"
              type="date"
              value={mForm.arrivalDate}
              onChange={(e) =>
                setMForm({ ...mForm, arrivalDate: e.target.value })
              }
            />
            <Input
              label="Vessel Name"
              value={mForm.vesselName}
              onChange={(e) =>
                setMForm({ ...mForm, vesselName: e.target.value })
              }
            />
            <Input
              label="Voyage No"
              value={mForm.voyageNo}
              onChange={(e) => setMForm({ ...mForm, voyageNo: e.target.value })}
            />
            <Input
              label="BL Number"
              value={mForm.blNumber}
              onChange={(e) => setMForm({ ...mForm, blNumber: e.target.value })}
            />
          </div>
          <div className="mt-3">
            <div className="mb-1.5 text-xs font-medium text-slate-400">
              Document Checklist
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DOCS.map((d) => (
                <label
                  key={d.key}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                    mForm[d.key]
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-700 bg-slate-800/60 text-slate-400"
                  }`}
                >
                  <span>
                    {d.label} —{" "}
                    {d.key === "docCi"
                      ? "Commercial Invoice"
                      : d.key === "docPl"
                        ? "Packing List"
                        : d.key === "docCoO"
                          ? "Certificate of Origin"
                          : "Bill of Lading"}
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(mForm[d.key])}
                    onChange={(e) =>
                      setMForm({ ...mForm, [d.key]: e.target.checked })
                    }
                    className="accent-emerald-500"
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMilestoneShipment(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveMilestones} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}{" "}
              Save Milestones
            </Button>
          </div>
        </ModalPanel>
      )}
    </div>
  );
}

function ModalPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <PageHeader
        title="Exim"
        description="Quotes, orders, receivables and commercial desk operations."
        icon={<FileText className="w-6 h-6" />}
        iconTone="amber"
      />

      <div
        className="h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700/60 bg-slate-900/95 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
