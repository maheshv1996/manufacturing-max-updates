"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Boxes,
  IndianRupee,
  Hourglass,
  CheckCircle2,
  XCircle,
  FileWarning,
} from "lucide-react";
import { Card, Button, StatusPill, KpiCard, Input } from "@/app/components/ui";

interface DeadMaterial {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currentStock: number;
  unitCost: number;
  value: number;
  lastMovement?: string | null;
  idleDays?: number | null;
}
interface WriteOffRequest {
  id: string;
  requestNumber: string;
  qty: number;
  unitValue: number;
  reason: string;
  status: string;
  requestedBy: string;
  requestedAt: string;
  decidedBy?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  rawMaterial: { name: string; sku: string };
}

export default function DeadStockClient() {
  const [dead, setDead] = useState<DeadMaterial[]>([]);
  const [requests, setRequests] = useState<WriteOffRequest[]>([]);
  const [stats, setStats] = useState({
    materials: 0,
    totalValue: 0,
    pending: 0,
    approvedValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposing, setProposing] = useState<DeadMaterial | null>(null);
  const [pQty, setPQty] = useState("");
  const [pReason, setPReason] = useState("");
  const [deciding, setDeciding] = useState<WriteOffRequest | null>(null);
  const [dNote, setDNote] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/write-off");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setDead(json.deadStock || []);
      setRequests(json.requests || []);
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

  const post = async (payload: any) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/write-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      return json;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const propose = async () => {
    if (!proposing) return;
    const json = await post({
      action: "propose",
      rawMaterialId: proposing.id,
      qty: pQty,
      reason: pReason,
    });
    if (json) {
      setProposing(null);
      setPQty("");
      setPReason("");
      await load();
    }
  };

  const decide = async (approve: boolean) => {
    if (!deciding) return;
    const json = await post({
      action: approve ? "approve" : "reject",
      requestId: deciding.id,
      note: dNote,
    });
    if (json) {
      setDeciding(null);
      setDNote("");
      await load();
    }
  };

  const pending = requests.filter((r) => r.status === "PENDING");

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          title="Dead Materials (180d+)"
          value={stats.materials}
          tone="rose"
          icon={<Boxes className="h-4 w-4" />}
        />
        <KpiCard
          title="Dead Stock Value"
          value={`₹${Math.round(stats.totalValue).toLocaleString("en-IN")}`}
          tone="amber"
          icon={<IndianRupee className="h-4 w-4" />}
        />
        <KpiCard
          title="Pending Write-offs"
          value={stats.pending}
          tone="sky"
          icon={<Hourglass className="h-4 w-4" />}
        />
        <KpiCard
          title="Write-offs YTD"
          value={`₹${Math.round(stats.approvedValue).toLocaleString("en-IN")}`}
          tone="emerald"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-800/60 p-4">
          <div>
            <h3 className="font-semibold text-slate-100">
              Dead Stock Register
            </h3>
            <p className="text-sm text-slate-500">
              No inventory movement (IN/OUT/ADJUST) in the last 180 days.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800/60 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Material</th>
                <th className="px-4 py-2.5 text-right">Stock</th>
                <th className="px-4 py-2.5 text-right">Unit Cost</th>
                <th className="px-4 py-2.5 text-right">Value</th>
                <th className="px-4 py-2.5">Last Movement</th>
                <th className="px-4 py-2.5">Idle</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-slate-400"
                  >
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{" "}
                    Analysing stock movement…
                  </td>
                </tr>
              ) : dead.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No dead stock — every material moved within the last 180
                    days.
                  </td>
                </tr>
              ) : (
                dead.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-200">{m.name}</div>
                      <div className="text-[11px] text-slate-500">{m.sku}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300">
                      {m.currentStock} {m.unit}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-400">
                      ₹{m.unitCost.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-amber-300">
                      ₹{Math.round(m.value).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">
                      {m.lastMovement
                        ? new Date(m.lastMovement).toLocaleDateString()
                        : "Never moved"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-400">
                        {m.idleDays !== null ? `${m.idleDays}d` : "∞"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setProposing(m);
                          setPQty(String(m.currentStock));
                          setPReason("");
                        }}
                      >
                        <FileWarning className="mr-1 h-3.5 w-3.5" /> Propose
                        Write-off
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-800/60 p-4">
          <div>
            <h3 className="font-semibold text-slate-100">Write-off Requests</h3>
            <p className="text-sm text-slate-500">
              Finance decision required on each request.
            </p>
          </div>
          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-400">
            {pending.length} pending
          </span>
        </div>
        <div className="divide-y divide-slate-800/60">
          {requests.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No write-off requests yet.
            </div>
          ) : (
            requests.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-start justify-between gap-3 p-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-100">
                      {r.requestNumber}
                    </span>
                    <StatusPill
                      variant={
                        r.status === "PENDING"
                          ? "warning"
                          : r.status === "APPROVED"
                            ? "success"
                            : "danger"
                      }
                      label={r.status}
                      dot
                    />
                    <span className="text-sm text-slate-400">
                      {r.rawMaterial.name} × {r.qty} — ₹
                      {(r.qty * r.unitValue).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500">
                    by {r.requestedBy} ·{" "}
                    {new Date(r.requestedAt).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500">“{r.reason}”</div>
                  {r.decidedBy && (
                    <div className="text-[11px] text-slate-500">
                      {r.status === "APPROVED" ? "Approved" : "Rejected"} by{" "}
                      {r.decidedBy}
                      {r.decisionNote ? `: “${r.decisionNote}”` : ""}
                    </div>
                  )}
                </div>
                {r.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => {
                        setDeciding(r);
                        setDNote("");
                      }}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setDeciding(r);
                        setDNote("");
                      }}
                    >
                      <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {proposing && (
        <ModalPanel
          title={`Propose Write-off — ${proposing.name}`}
          onClose={() => setProposing(null)}
        >
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-slate-400">
            {proposing.sku} · {proposing.currentStock} {proposing.unit} in stock
            @ ₹{proposing.unitCost} — value ₹
            {Math.round(proposing.value).toLocaleString("en-IN")}. Idle since{" "}
            {proposing.lastMovement
              ? new Date(proposing.lastMovement).toLocaleDateString()
              : "first stock in"}
            .
          </div>
          <div className="mt-3 space-y-3">
            <Input
              label="Qty to write off *"
              type="number"
              value={pQty}
              onChange={(e) => setPQty(e.target.value)}
              max={proposing.currentStock}
            />
            <Input
              label="Reason *"
              value={pReason}
              onChange={(e) => setPReason(e.target.value)}
              placeholder="e.g. Obsolete grade, no usage since 2025 — suggested for disposal"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setProposing(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={propose}
              disabled={
                busy || !pQty || parseFloat(pQty) <= 0 || !pReason.trim()
              }
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}{" "}
              Submit to Finance
            </Button>
          </div>
        </ModalPanel>
      )}

      {deciding && (
        <ModalPanel
          title={`${deciding.status === "PENDING" ? "Decide" : ""} Write-off ${deciding.requestNumber} — ${deciding.rawMaterial.name}`}
          onClose={() => setDeciding(null)}
        >
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-3 text-sm text-slate-300">
            {deciding.rawMaterial.name} × {deciding.qty} — ₹
            {(deciding.qty * deciding.unitValue).toLocaleString("en-IN")}
            <div className="mt-1 text-[11px] text-slate-500">
              Requested by {deciding.requestedBy} · “{deciding.reason}”
            </div>
          </div>
          <div className="mt-3">
            <Input
              label="Finance note *"
              value={dNote}
              onChange={(e) => setDNote(e.target.value)}
              placeholder="e.g. Approved — obsolete inventory, disposal authorised"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeciding(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => decide(false)}
              disabled={busy || !dNote.trim()}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}{" "}
              Reject
            </Button>
            <Button
              variant="success"
              onClick={() => decide(true)}
              disabled={busy || !dNote.trim()}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}{" "}
              Approve & Adjust Stock
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
