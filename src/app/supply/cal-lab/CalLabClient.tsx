"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FlaskConical,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Send,
  BadgeCheck,
  Loader2,
  Star,
} from "lucide-react";
import { Button, Input, Select } from "@/app/components/ui";

interface Instrument {
  id: string;
  name: string;
  serialNumber: string;
  expiresAt: string;
  costRupees: number | null;
  status: string;
  daysLeft: number;
}
interface Requisition {
  id: string;
  reqNumber: string;
  title: string;
  description: string | null;
  status: string;
  vendor: { id: string; name: string } | null;
  vendorName: string | null;
  estimatedAmount: number;
  targetDate: string | null;
  instruments: Instrument[];
  source: string;
  requestedBy: string;
  approvedBy: string | null;
  rejectionReason: string | null;
  notes: string | null;
}
interface Rating {
  id: string;
  vendor: { id: string; name: string };
  period: string;
  onTimeDelivery: number;
  certQuality: number;
  overallScore: number;
  grade: string;
  notes: string | null;
}
interface Supplier {
  id: string;
  name: string;
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  SUBMITTED: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  APPROVED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  COMPLETED: "bg-violet-500/15 text-violet-300 border-violet-500/40",
  REJECTED: "bg-rose-500/15 text-rose-300 border-rose-500/40",
};

const GRADE_STYLE: Record<string, string> = {
  A: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  B: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  C: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  D: "bg-rose-500/20 text-rose-300 border-rose-500/40",
};

export default function CalLabClient() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [due, setDue] = useState<Instrument[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [reason, setReason] = useState("");

  // submit form state
  const [vendorId, setVendorId] = useState("");
  const [amount, setAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");

  // rating form state
  const [ratingVendor, setRatingVendor] = useState("");
  const [ratingPeriod, setRatingPeriod] = useState("");
  const [ratingOtd, setRatingOtd] = useState("");
  const [ratingCert, setRatingCert] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/cal-lab");
      const data = await res.json();
      setRequisitions(data.requisitions || []);
      setDue(data.due || []);
      setRatings(data.ratings || []);
      setSuppliers(data.suppliers || []);
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

  const act = async (action: string, payload: any) => {
    setMsg("");
    setBusy(action + ":" + (payload.id || payload.vendorId || ""));
    try {
      const res = await fetch("/api/cal-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: payload }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(data.message || `Done — ${action}`);
        await fetchAll();
      } else {
        setMsg(data.error || "Action failed");
      }
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-emerald-300 font-semibold">{msg}</p>}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: "Instruments total",
            value: stats.totalTools ?? "—",
            icon: <FlaskConical className="h-5 w-5 text-teal-500" />,
          },
          {
            label: "Due < 30 days",
            value: stats.dueCount ?? "—",
            icon: <AlertTriangle className="h-5 w-5 text-rose-500" />,
            tone: (stats.dueCount || 0) > 0 ? "text-rose-500" : undefined,
          },
          {
            label: "Draft requisitions",
            value: stats.draft ?? "—",
            icon: <Clock className="h-5 w-5 text-sky-500" />,
          },
          {
            label: "Submitted to Supply",
            value: stats.submitted ?? "—",
            icon: <Send className="h-5 w-5 text-amber-500" />,
          },
          {
            label: "Completed",
            value: stats.completed ?? "—",
            icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 flex items-center gap-3"
          >
            {k.icon}
            <div>
              <p className={`text-2xl font-black text-white ${k.tone || ""}`}>
                {k.value}
              </p>
              <p className="text-xs text-slate-400">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => act("scan", {})} disabled={busy !== null}>
          <Loader2
            className={`w-4 h-4 ${busy === "scan:" ? "animate-spin" : ""}`}
          />
          Auto-scan due instruments → draft requisition
        </Button>
      </div>

      {/* Due instruments */}
      {due.length > 0 && (
        <section className="rounded-2xl bg-rose-950/20 border border-rose-500/30 p-4 space-y-2">
          <h3 className="font-bold text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Instruments due within 30 days
            ({due.length}) — not yet requisitioned
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {due.map((t) => (
              <div
                key={t.id}
                className="rounded-xl bg-slate-800/60 border border-slate-700 px-3 py-2"
              >
                <p className="text-sm font-semibold text-white">{t.name}</p>
                <p className="text-xs text-slate-400 font-mono">
                  {t.serialNumber} ·{" "}
                  {t.daysLeft > 0 ? `${t.daysLeft}d left` : "EXPIRED"}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Requisitions pipeline */}
      <section className="space-y-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Send className="h-5 w-5 text-amber-400" /> Calibration Requisitions
          (Metrology → Supply)
        </h3>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : requisitions.length === 0 ? (
          <p className="text-sm text-slate-400 rounded-2xl bg-slate-800/40 border border-slate-800 p-4">
            No requisitions yet — run "Auto-scan" to draft one for instruments
            due within 30 days.
          </p>
        ) : (
          requisitions.map((r) => (
            <details
              key={r.id}
              className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4"
            >
              <summary className="cursor-pointer flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${r.status === "COMPLETED" ? "bg-violet-400" : r.status === "REJECTED" ? "bg-rose-400" : r.status === "APPROVED" ? "bg-emerald-400" : r.status === "SUBMITTED" ? "bg-amber-400" : "bg-sky-400"}`}
                  />
                  <span className="font-bold text-white">{r.reqNumber}</span>
                  <span className="text-sm text-slate-300">{r.title}</span>
                  <span className="text-xs text-slate-400">
                    {r.source === "CAL_LAB_AUTO" ? "auto" : "manual"} ·{" "}
                    {r.requestedBy}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full border text-xs font-bold ${STATUS_STYLE[r.status]}`}
                >
                  {r.status}
                </span>
              </summary>
              <div className="mt-3 space-y-3">
                <p className="text-xs text-slate-400">{r.description}</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {(r.instruments || []).map((t: any) => (
                    <div
                      key={t.id}
                      className="rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm text-white font-medium">
                          {t.name}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          {t.serialNumber}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-bold ${t.daysLeft > 0 ? "text-amber-300" : "text-rose-300"}`}
                      >
                        {t.daysLeft > 0 ? `${t.daysLeft}d` : "EXPIRED"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
                  <span className="text-slate-300">
                    {r.vendorName ||
                      (r.vendor ? r.vendor.name : "No lab assigned yet")}{" "}
                    · ₹{r.estimatedAmount.toLocaleString("en-IN")}
                    {r.targetDate
                      ? ` · due ${new Date(r.targetDate).toLocaleDateString()}`
                      : ""}
                  </span>
                  {r.approvedBy && (
                    <span className="text-xs text-emerald-300">
                      Approved by {r.approvedBy}
                    </span>
                  )}
                  {r.rejectionReason && (
                    <span className="text-xs text-rose-300">
                      Rejected: {r.rejectionReason}
                    </span>
                  )}
                  {r.notes && (
                    <span className="text-xs text-slate-500">{r.notes}</span>
                  )}
                </div>

                {/* Actions */}
                {r.status === "DRAFT" && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <Select
                      value={vendorId}
                      onChange={(e) => setVendorId(e.target.value)}
                      className="w-56"
                    >
                      <option value="">Lab vendor…</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      placeholder="Est. amount ₹"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-32"
                    />
                    <Input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-40"
                    />
                    <Button
                      onClick={() =>
                        act("submit", {
                          id: r.id,
                          vendorId,
                          estimatedAmount: amount,
                          targetDate,
                        })
                      }
                      disabled={busy !== null}
                      size="sm"
                    >
                      <Send className="w-4 h-4" /> Submit to Supply
                    </Button>
                  </div>
                )}
                {r.status === "SUBMITTED" && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <Input
                      placeholder="Decision reason (audit trail)…"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="flex-1 min-w-52"
                    />
                    <Button
                      onClick={() =>
                        act("approve", { id: r.id, reason: reason.trim() })
                      }
                      disabled={busy !== null}
                      size="sm"
                    >
                      <BadgeCheck className="w-4 h-4" /> Approve
                    </Button>
                    <Button
                      onClick={() =>
                        act("reject", { id: r.id, reason: reason.trim() })
                      }
                      disabled={busy !== null}
                      variant="outline"
                      size="sm"
                    >
                      Reject
                    </Button>
                  </div>
                )}
                {r.status === "APPROVED" && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <Input
                      type="number"
                      placeholder="Interval days (default 365)"
                      defaultValue={365}
                      id={`interval-${r.id}`}
                      className="w-44"
                    />
                    <Input
                      placeholder="Completion note (audit trail)…"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="flex-1 min-w-52"
                    />
                    <Button
                      onClick={() => {
                        const el = document.getElementById(
                          `interval-${r.id}`,
                        ) as HTMLInputElement;
                        act("complete", {
                          id: r.id,
                          intervalDays: el?.value || 365,
                          reason: reason.trim(),
                        });
                      }}
                      disabled={busy !== null}
                      size="sm"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Complete —
                      recalibrated
                    </Button>
                  </div>
                )}
              </div>
            </details>
          ))
        )}
      </section>

      {/* Lab vendor ratings */}
      <section className="space-y-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-400" /> Lab Vendor Ratings
        </h3>
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={ratingVendor}
              onChange={(e) => setRatingVendor(e.target.value)}
              className="w-56"
            >
              <option value="">Lab vendor…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Input
              type="month"
              value={ratingPeriod}
              onChange={(e) => setRatingPeriod(e.target.value)}
              className="w-40"
            />
            <Input
              type="number"
              placeholder="On-time %"
              value={ratingOtd}
              onChange={(e) => setRatingOtd(e.target.value)}
              className="w-32"
            />
            <Input
              type="number"
              placeholder="Cert quality %"
              value={ratingCert}
              onChange={(e) => setRatingCert(e.target.value)}
              className="w-32"
            />
            <Input
              placeholder="Reason (audit trail)…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="flex-1 min-w-52"
            />
            <Button
              onClick={() =>
                act("rate", {
                  vendorId: ratingVendor,
                  period: ratingPeriod,
                  onTimeDelivery: ratingOtd,
                  certQuality: ratingCert,
                  reason: reason.trim(),
                })
              }
              disabled={busy !== null || !ratingVendor || !ratingPeriod}
              size="sm"
            >
              <Star className="w-4 h-4" /> Save rating
            </Button>
          </div>
          {ratings.length === 0 ? (
            <p className="text-sm text-slate-400">
              No ratings yet — score labs on on-time delivery and certificate
              quality.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ratings.map((rt) => (
                <div
                  key={rt.id}
                  className="rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">
                      {rt.vendor.name}
                    </p>
                    <span
                      className={`px-2 py-0.5 rounded-full border text-xs font-black ${GRADE_STYLE[rt.grade]}`}
                    >
                      {rt.grade}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{rt.period}</p>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      On-time {rt.onTimeDelivery}%
                    </span>
                    <span className="text-slate-400">
                      Cert {rt.certQuality}%
                    </span>
                    <span className="font-bold text-white">
                      {rt.overallScore}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
