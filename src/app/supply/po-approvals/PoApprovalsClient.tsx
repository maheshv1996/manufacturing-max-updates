"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, Button, StatusPill, KpiCard, Input } from "@/app/components/ui";

interface Po {
  id: string;
  poNumber: string;
  qty: number;
  unitCost: number;
  status: string;
  expectedDate?: string | null;
  receivedQty: number;
  createdBy: string;
  approvalStatus: string;
  approvalLevel?: string | null;
  managerApprovedBy?: string | null;
  managerApprovedAt?: string | null;
  ownerApprovedBy?: string | null;
  ownerApprovedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  supplier: { name: string };
  rawMaterial: { name: string };
}

const pillVariant: Record<string, any> = {
  APPROVED: "success",
  PENDING_MANAGER: "warning",
  PENDING_OWNER: "danger",
  REJECTED: "danger",
};

const ORDER = ["PENDING_OWNER", "PENDING_MANAGER", "APPROVED", "REJECTED"];

export default function PoApprovalsClient() {
  const [pos, setPos] = useState<Po[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<{ po: Po; approve: boolean } | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [tab, setTab] = useState("PENDING");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/purchasing");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setPos(json.purchaseOrders || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!decision) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/purchasing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: decision.approve ? "APPROVE_PO" : "REJECT_PO",
          poId: decision.po.id,
          reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Decision failed");
      setDecision(null);
      setReason("");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const rows = [...pos].sort(
    (a, b) => ORDER.indexOf(a.approvalStatus) - ORDER.indexOf(b.approvalStatus),
  );
  const pending = rows.filter((p) => p.approvalStatus.startsWith("PENDING"));
  const approved = rows.filter((p) => p.approvalStatus === "APPROVED");
  const rejected = rows.filter((p) => p.approvalStatus === "REJECTED");
  const shown =
    tab === "PENDING" ? pending : tab === "APPROVED" ? approved : rejected;
  const totalValue = (p: Po) => p.qty * p.unitCost;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          title="Awaiting Approval"
          value={pending.length}
          tone="amber"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <KpiCard
          title="Pending Owner"
          value={pos.filter((p) => p.approvalStatus === "PENDING_OWNER").length}
          tone="rose"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <KpiCard
          title="Approved"
          value={approved.length}
          tone="emerald"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <KpiCard
          title="Rejected"
          value={rejected.length}
          tone="slate"
          icon={<XCircle className="h-4 w-4" />}
        />
      </div>

      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-800/60 p-4">
          {["PENDING", "APPROVED", "REJECTED"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                tab === t
                  ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                  : "text-slate-400 border border-transparent hover:bg-slate-800/60"
              }`}
            >
              {t} (
              {t === "PENDING"
                ? pending.length
                : t === "APPROVED"
                  ? approved.length
                  : rejected.length}
              )
            </button>
          ))}
        </div>

        <div className="divide-y divide-slate-800/60">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading POs…
            </div>
          ) : shown.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              No purchase orders in this state.
            </div>
          ) : (
            shown.map((po) => (
              <div
                key={po.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-100">
                      {po.poNumber}
                    </span>
                    <StatusPill
                      variant={pillVariant[po.approvalStatus] || "neutral"}
                      label={po.approvalStatus}
                      dot
                    />
                    {po.approvalLevel && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${
                          po.approvalLevel === "OWNER"
                            ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        Needs {po.approvalLevel}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-400">
                    {po.rawMaterial.name} × {po.qty} · {po.supplier.name} ·{" "}
                    {po.expectedDate
                      ? `due ${new Date(po.expectedDate).toLocaleDateString()} · `
                      : ""}
                    raised by {po.createdBy}
                  </div>
                  {(po.managerApprovedBy || po.ownerApprovedBy) && (
                    <div className="text-[11px] text-slate-500">
                      {po.managerApprovedBy &&
                        `Manager: ${po.managerApprovedBy} (${po.managerApprovedAt ? new Date(po.managerApprovedAt).toLocaleString() : ""}) `}
                      {po.ownerApprovedBy &&
                        `Owner: ${po.ownerApprovedBy} (${po.ownerApprovedAt ? new Date(po.ownerApprovedAt).toLocaleString() : ""})`}
                    </div>
                  )}
                  {po.rejectionReason && (
                    <div className="text-[11px] text-rose-400">
                      Rejected by {po.rejectedBy}: {po.rejectionReason}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-base font-semibold text-slate-100">
                      ₹
                      {totalValue(po).toLocaleString("en-IN", {
                        maximumFractionDigits: 0,
                      })}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      @{po.unitCost}/unit
                    </div>
                  </div>
                  {po.approvalStatus.startsWith("PENDING") && (
                    <div className="flex gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => setDecision({ po, approve: true })}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDecision({ po, approve: false })}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {decision && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setDecision(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900/95 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center gap-2">
              {decision.approve ? (
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              ) : (
                <XCircle className="h-5 w-5 text-rose-400" />
              )}
              <h3 className="text-lg font-semibold text-slate-100">
                {decision.approve ? "Approve" : "Reject"} {decision.po.poNumber}
              </h3>
            </div>
            <p className="mb-4 text-sm text-slate-400">
              {decision.po.rawMaterial.name} × {decision.po.qty} — ₹
              {totalValue(decision.po).toLocaleString("en-IN", {
                maximumFractionDigits: 0,
              })}{" "}
              from {decision.po.supplier.name}.
              {!decision.approve && poRequiresOwner(decision.po)
                ? " Owner approval level — rejection needs manager."
                : ""}
            </p>
            <Input
              label="Written reason *"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                decision.approve
                  ? "e.g. Within budget, supplier rate verified"
                  : "e.g. Exceeds budget without rate contract"
              }
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDecision(null)}>
                Cancel
              </Button>
              <Button
                variant={decision.approve ? "success" : "danger"}
                onClick={submit}
                disabled={busy || !reason.trim()}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : null}
                {decision.approve ? "Approve PO" : "Reject PO"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function poRequiresOwner(po: Po) {
  return po.approvalLevel === "OWNER";
}
