"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Truck, Printer, AlertTriangle } from "lucide-react";
import { Button, Input, Select } from "@/app/components/ui";

interface DispatchableWo {
  id: string;
  woNumber: string;
  product: { name: string } | null;
  plannedQuantity: number;
  customerName: string | null;
  dispatchRecords: { id: string }[];
  invoices: { invoiceNumber: string }[];
}
interface Dispatch {
  id: string;
  challanNumber: string;
  gatePassNumber: string | null;
  dispatchedQty: number;
  carrierName: string | null;
  vehicleNumber: string | null;
  driverName: string | null;
  ewayBillNo: string | null;
  dispatchedByName: string;
  dispatchedAt: string;
  workOrder: {
    woNumber: string;
    product: { name: string } | null;
    customerName: string | null;
  } | null;
}

export default function GatePassClient() {
  const [dispatchableWos, setDispatchableWos] = useState<DispatchableWo[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [woId, setWoId] = useState("");
  const [qty, setQty] = useState("");
  const [carrier, setCarrier] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [driver, setDriver] = useState("");
  const [eway, setEway] = useState("");
  const [notes, setNotes] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/gate-pass");
      const data = await res.json();
      setDispatchableWos(data.dispatchableWos || []);
      setDispatches(data.dispatches || []);
      setStats(data.stats || {});
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createDispatch = async () => {
    setMsg("");
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/gate-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId: woId,
          dispatchedQty: qty,
          carrierName: carrier,
          vehicleNumber: vehicle,
          driverName: driver,
          ewayBillNo: eway,
          notes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(
          `Gate pass ${data.dispatch.gatePassNumber} issued — ${data.dispatch.workOrder?.workOrder?.woNumber || data.dispatch.challanNumber} out the gate.`,
        );
        setWoId("");
        setQty("");
        setCarrier("");
        setVehicle("");
        setDriver("");
        setEway("");
        setNotes("");
        await fetchAll();
      } else {
        setErr(data.error || "Dispatch failed");
      }
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-emerald-300 font-semibold">{msg}</p>}
      {err && (
        <p className="text-sm text-rose-300 font-semibold flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" /> {err}
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total dispatches",
            value: stats.dispatches ?? "—",
            icon: <Truck className="h-5 w-5 text-sky-500" />,
          },
          {
            label: "Gate passes issued",
            value: stats.withGatePass ?? "—",
            icon: <ShieldCheck className="h-5 w-5 text-emerald-500" />,
          },
          {
            label: "Pending dispatch",
            value: stats.pendingDispatch ?? "—",
            icon: <Truck className="h-5 w-5 text-amber-500" />,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 flex items-center gap-3"
          >
            {k.icon}
            <div>
              <p className="text-2xl font-black text-white">{k.value}</p>
              <p className="text-xs text-slate-400">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 space-y-3">
        <h3 className="font-bold text-white flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" /> New gate pass /
          dispatch
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <Select
            value={woId}
            onChange={(e) => setWoId(e.target.value)}
            className="lg:col-span-1"
          >
            <option value="">Completed WO to dispatch…</option>
            {dispatchableWos.map((w) => (
              <option key={w.id} value={w.id}>
                {w.woNumber} · {w.product?.name} ({w.plannedQuantity} pcs)
              </option>
            ))}
          </Select>
          <Input
            type="number"
            placeholder="Qty to dispatch"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <Input
            placeholder="Carrier (optional)"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
          />
          <Input
            placeholder="Vehicle number *"
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
          />
          <Input
            placeholder="Driver name *"
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
          />
          <Input
            placeholder="E-way bill no. * (GST)"
            value={eway}
            onChange={(e) => setEway(e.target.value)}
          />
          <Input
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <Button onClick={createDispatch} disabled={busy || !woId}>
          <ShieldCheck className="w-4 h-4" /> Issue gate pass & dispatch
        </Button>
        <p className="text-xs text-slate-500">
          * Mandatory — a dispatch without vehicle, driver and e-way bill is
          blocked at the gate (GATE_PASS_INCOMPLETE).
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-bold text-white">
          Dispatches & Gate Passes
        </h3>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : dispatches.length === 0 ? (
          <p className="text-sm text-slate-400 rounded-2xl bg-slate-800/40 border border-slate-800 p-4">
            No dispatches yet.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {dispatches.map((d) => (
              <div
                key={d.id}
                className="rounded-xl bg-slate-800/60 border border-slate-700 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">
                    {d.gatePassNumber || d.challanNumber}
                  </p>
                  <a
                    href={`/reports/gate-pass/${d.id}`}
                    target="_blank"
                    className="flex items-center gap-1 text-xs font-bold text-emerald-300 hover:text-emerald-200"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print
                  </a>
                </div>
                <p className="text-xs text-slate-300">
                  {d.workOrder?.woNumber} · {d.workOrder?.product?.name} ·{" "}
                  {d.dispatchedQty} pcs
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  {d.vehicleNumber} / {d.driverName} · e-way {d.ewayBillNo}
                  {d.workOrder?.customerName
                    ? ` · ${d.workOrder.customerName}`
                    : ""}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(d.dispatchedAt).toLocaleString()} ·{" "}
                  {d.dispatchedByName}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
