"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Truck,
  Timer,
  AlertTriangle,
  PackageCheck,
  Star,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  Button,
  StatusPill,
  KpiCard,
  Input,
  Select,
} from "@/app/components/ui";
import DynamicRegister from "@/app/components/shared/DynamicRegister";
import type { RegisterConfig } from "@/app/components/shared/DynamicRegister";

interface Vendor {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  lanes?: string | null;
  rating: number;
  isApproved?: boolean | null;
  notes?: string | null;
}
interface Dispatch {
  id: string;
  dispatchNumber: string;
  reference?: string | null;
  route?: string | null;
  vehicleNumber?: string | null;
  pickupDate?: string | null;
  promisedDate: string;
  actualDate?: string | null;
  charges: number;
  status: string;
  notes?: string | null;
  vendor: Vendor;
}
interface Scorecard {
  vendor: {
    id: string;
    name: string;
    rating: number;
    isApproved?: boolean | null;
    lanes?: string | null;
    contactPerson?: string | null;
    phone?: string | null;
  };
  dispatches: number;
  delivered: number;
  onTime: number;
  onTimePct: number | null;
  avgLead: number | null;
  totalSpend: number;
  inTransit: number;
  active: boolean;
}

const COLUMNS = ["SCHEDULED", "IN_TRANSIT", "DELIVERED", "DELAYED"] as const;

const vendorRegister: RegisterConfig = {
  title: "Freight Vendor Register",
  description: "Approved freight carriers, lanes and ratings.",
  entity: "freightVendors",
  icon: Truck,
  accent: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  fields: [
    { key: "name", label: "Vendor Name", required: true },
    { key: "contactPerson", label: "Contact Person" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "city", label: "City" },
    {
      key: "lanes",
      label: "Lanes",
      placeholder: "e.g. Chennai–Pune; Delhi–Mumbai",
    },
    { key: "rating", label: "Rating (1-5)", type: "number" },
    {
      key: "isApproved",
      label: "Approved Vendor",
      type: "select",
      options: ["true", "false"],
    },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  columns: [
    { key: "name", label: "Vendor" },
    { key: "city", label: "City" },
    { key: "lanes", label: "Lanes" },
    { key: "rating", label: "Rating" },
    { key: "isApproved", label: "Approved", format: "boolean" },
  ],
  searchKeys: ["name", "city", "lanes"],
};

export default function FreightClient() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [stats, setStats] = useState({
    overdue: 0,
    dueThisWeek: 0,
    inTransit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({
    vendorId: "",
    reference: "",
    route: "",
    vehicleNumber: "",
    pickupDate: "",
    promisedDate: "",
    charges: "",
    notes: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/freight");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setVendors(json.vendors || []);
      setDispatches(json.dispatches || []);
      setScorecards(json.scorecards || []);
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

  const createDispatch = async () => {
    if (!form.vendorId || !form.promisedDate) {
      setError("Vendor and promised date are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/freight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_dispatch", ...form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      setCreateOpen(false);
      setForm({
        vendorId: "",
        reference: "",
        route: "",
        vehicleNumber: "",
        pickupDate: "",
        promisedDate: "",
        charges: "",
        notes: "",
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (d: Dispatch, status: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/freight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_status",
          dispatchId: d.id,
          status,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const today = new Date();
  const avgOtp =
    scorecards.filter((s) => s.onTimePct !== null).length > 0
      ? Math.round(
          scorecards.reduce((a, s) => a + (s.onTimePct || 0), 0) /
            scorecards.filter((s) => s.onTimePct !== null).length,
        )
      : null;

  const byColumn = (col: string) => dispatches.filter((d) => d.status === col);
  const isOverdue = (d: Dispatch) =>
    d.status !== "DELIVERED" &&
    d.status !== "CANCELLED" &&
    new Date(d.promisedDate) < today;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          title="Active Vendors"
          value={vendors.length}
          tone="sky"
          icon={<Truck className="h-4 w-4" />}
        />
        <KpiCard
          title="In Transit"
          value={stats.inTransit}
          tone="amber"
          icon={<Timer className="h-4 w-4" />}
        />
        <KpiCard
          title="Due (3 days)"
          value={stats.dueThisWeek}
          tone="cyan"
          icon={<ArrowRight className="h-4 w-4" />}
        />
        <KpiCard
          title="Overdue"
          value={stats.overdue}
          tone="rose"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-800/60 p-4">
          <div>
            <h3 className="font-semibold text-slate-100">
              Dispatch Schedule Board
            </h3>
            <p className="text-sm text-slate-500">
              Promised-date board — overdue dispatches highlight red.
            </p>
          </div>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Schedule Dispatch
          </Button>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading board…
            </div>
          ) : (
            COLUMNS.map((col) => (
              <div key={col} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {col}
                  </span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                    {byColumn(col).length}
                  </span>
                </div>
                {byColumn(col).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-800 px-3 py-6 text-center text-xs text-slate-600">
                    Empty
                  </div>
                ) : (
                  byColumn(col).map((d) => (
                    <div
                      key={d.id}
                      className={`rounded-lg border p-3 text-sm ${
                        isOverdue(d)
                          ? "border-rose-500/40 bg-rose-500/5"
                          : "border-slate-700/60 bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-200">
                          {d.dispatchNumber}
                        </span>
                        {isOverdue(d) && (
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                        )}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {d.vendor.name}
                        {d.route ? ` · ${d.route}` : ""}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                        {d.reference && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5">
                            {d.reference}
                          </span>
                        )}
                        {d.vehicleNumber && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5">
                            {d.vehicleNumber}
                          </span>
                        )}
                        <span
                          className={
                            isOverdue(d) ? "font-medium text-rose-400" : ""
                          }
                        >
                          {new Date(d.promisedDate).toLocaleDateString()}
                        </span>
                      </div>
                      {col !== "DELIVERED" && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {col === "SCHEDULED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateStatus(d, "IN_TRANSIT")}
                              disabled={busy}
                            >
                              Start
                            </Button>
                          )}
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => updateStatus(d, "DELIVERED")}
                            disabled={busy}
                          >
                            <PackageCheck className="mr-1 h-3 w-3" /> Delivered
                          </Button>
                          {col === "SCHEDULED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateStatus(d, "DELAYED")}
                              disabled={busy}
                            >
                              Delay
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-800/60 p-4">
          <div>
            <h3 className="font-semibold text-slate-100">
              On-Time Performance
            </h3>
            <p className="text-sm text-slate-500">
              Overall on-time delivery
              {avgOtp !== null ? ` · ${avgOtp}% average` : ""} — fresh
              dispatches move scorecards when delivered.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/60 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Vendor</th>
                <th className="px-4 py-2.5">Rating</th>
                <th className="px-4 py-2.5 text-right">Dispatches</th>
                <th className="px-4 py-2.5 text-right">Delivered</th>
                <th className="px-4 py-2.5 text-right">On-time</th>
                <th className="px-4 py-2.5 text-right">OTP %</th>
                <th className="px-4 py-2.5 text-right">Avg Lead (d)</th>
                <th className="px-4 py-2.5 text-right">Spend ₹</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {scorecards.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No freight vendors registered yet.
                  </td>
                </tr>
              ) : (
                scorecards.map((s) => (
                  <tr key={s.vendor.id}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-200">
                        {s.vendor.name}
                        {(s.vendor.isApproved ?? true) && s.dispatches > 0 ? (
                          <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
                            APPROVED
                          </span>
                        ) : null}
                        {s.active && (
                          <span className="ml-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-400">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {s.vendor.lanes || "—"}
                        {s.vendor.contactPerson
                          ? ` · ${s.vendor.contactPerson}`
                          : ""}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <Star className="h-3.5 w-3.5 fill-amber-400" />{" "}
                        {s.vendor.rating}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300">
                      {s.dispatches}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300">
                      {s.delivered}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300">
                      {s.onTime}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {s.onTimePct === null ? (
                        <span className="text-slate-500">—</span>
                      ) : (
                        <StatusPill
                          variant={
                            s.onTimePct >= 90
                              ? "success"
                              : s.onTimePct >= 75
                                ? "warning"
                                : "danger"
                          }
                          label={`${s.onTimePct}%`}
                          dot
                        />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-400">
                      {s.avgLead ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300">
                      {Math.round(s.totalSpend).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <DynamicRegister config={vendorRegister} />

      {createOpen && (
        <ModalPanel
          title="Schedule Dispatch"
          onClose={() => setCreateOpen(false)}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Select
                label="Freight Vendor *"
                value={form.vendorId}
                onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
              >
                <option value="">Select vendor…</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.city ? ` (${v.city})` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <Input
              label="Reference"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="WO / GRN no."
            />
            <Input
              label="Route"
              value={form.route}
              onChange={(e) => setForm({ ...form, route: e.target.value })}
              placeholder="Delhi → Pune"
            />
            <Input
              label="Pickup Date"
              type="date"
              value={form.pickupDate}
              onChange={(e) => setForm({ ...form, pickupDate: e.target.value })}
            />
            <Input
              label="Promised Date *"
              type="date"
              value={form.promisedDate}
              onChange={(e) =>
                setForm({ ...form, promisedDate: e.target.value })
              }
            />
            <Input
              label="Vehicle No."
              value={form.vehicleNumber}
              onChange={(e) =>
                setForm({ ...form, vehicleNumber: e.target.value })
              }
            />
            <Input
              label="Charges (₹)"
              type="number"
              value={form.charges}
              onChange={(e) => setForm({ ...form, charges: e.target.value })}
            />
            <div className="col-span-2">
              <Input
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={createDispatch}
              disabled={busy || !form.vendorId || !form.promisedDate}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}{" "}
              Schedule Dispatch
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
