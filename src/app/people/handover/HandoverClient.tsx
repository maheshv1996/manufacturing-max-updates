"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Save,
  Wand2,
  Search,
  CheckCircle2,
  Clock,
  User,
  FileText,
  ClipboardEdit,
  AlertTriangle,
  Target,
  Wrench,
} from "lucide-react";
import SourceRecordEditModal from "@/app/components/modals/SourceRecordEditModal";

export default function HandoverClient({
  shifts,
  machines,
}: {
  shifts: any[];
  machines: any[];
  users: any[];
}) {
  // Form State
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [shiftId, setShiftId] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [machineId, setMachineId] = useState("PLANT");

  const [productionNotes, setProductionNotes] = useState("");
  const [downtimeNotes, setDowntimeNotes] = useState("");
  const [safetyNotes, setSafetyNotes] = useState("");
  const [nextShiftActions, setNextShiftActions] = useState("");
  const [missReason, setMissReason] = useState("");

  // Plan vs Actual Metrics State
  const [totalPlanned, setTotalPlanned] = useState<number>(1000);
  const [totalGood, setTotalGood] = useState<number>(0);
  const [achievementPct, setAchievementPct] = useState<number>(100);
  const [targetMissed, setTargetMissed] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);

  // History State
  const [handovers, setHandovers] = useState<any[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [ackId, setAckId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Filters State
  const [filterShift, setFilterShift] = useState("");
  const [filterMachine, setFilterMachine] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Auto-detect shift on mount
  useEffect(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });

    let detectedShift = shifts[0]?.id;
    for (const shift of shifts) {
      if (timeStr >= shift.startTime && timeStr <= shift.endTime) {
        detectedShift = shift.id;
        break;
      }
    }
    setShiftId(detectedShift || "");
  }, [shifts]);

  // Fetch Plan vs Actual Metrics dynamically
  const fetchPlanVsActual = async () => {
    try {
      const params = new URLSearchParams({ date, machineId });
      const res = await fetch(`/api/handover/autofill?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTotalGood(data.totalGood || 0);
        setTotalPlanned(data.totalPlanned || 1000);
        setAchievementPct(data.achievementPct || 0);
        setTargetMissed(Boolean(data.targetMissed));
      }
    } catch (e) {
      logClientError("Failed to fetch plan vs actual metrics:", e, "HandoverClient");
    }
  };

  useEffect(() => {
    fetchPlanVsActual();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, machineId]);

  // Fetch History
  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterShift, filterMachine]);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      if (filterShift) params.append("shiftId", filterShift);
      if (filterMachine) params.append("machineId", filterMachine);

      const res = await fetch(`/api/handover?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setHandovers(data);
      }
    } catch (e) {
      logClientError(e, "HandoverClient");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleAutofill = async () => {
    setIsAutofilling(true);
    try {
      const params = new URLSearchParams({ date, machineId });
      const res = await fetch(`/api/handover/autofill?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProductionNotes(data.productionNotes || "");
        setDowntimeNotes(data.downtimeNotes || "");
        if (!safetyNotes) setSafetyNotes("No safety incidents reported.");
        if (!nextShiftActions) setNextShiftActions("None.");

        setTotalGood(data.totalGood || 0);
        setTotalPlanned(data.totalPlanned || 1000);
        setAchievementPct(data.achievementPct || 0);
        setTargetMissed(Boolean(data.targetMissed));
      }
    } catch (e) {
      logClientError("Autofill failed", e, "HandoverClient");
    } finally {
      setIsAutofilling(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (targetMissed && (!missReason || !missReason.trim())) {
      alert(
        "Target was missed (< 95% of plan). A 'Why did we miss plan?' reason is MANDATORY.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/handover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          shiftId,
          authorName,
          machineId,
          productionNotes,
          downtimeNotes,
          safetyNotes,
          nextShiftActions,
          missReason: missReason.trim(),
          targetMissed,
        }),
      });

      if (res.ok) {
        alert("Shift Handover saved successfully!");
        setProductionNotes("");
        setDowntimeNotes("");
        setSafetyNotes("");
        setNextShiftActions("");
        setMissReason("");
        fetchHistory();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save handover.");
      }
    } catch (e) {
      logClientError(e, "HandoverClient");
      alert("Failed to save handover.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // P6 — incoming supervisor acknowledges the previous shift's logbook.
  const handleAck = async (h: any) => {
    const reason = window.prompt(
      `Acknowledge handover from ${h.authorName} (${h.shift?.name || "shift"})? Provide a confirmation note.`,
    );
    if (reason === null) return;
    setAckId(h.id);
    try {
      const res = await fetch("/api/handover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ack", id: h.id, reason }),
      });
      if (res.ok) {
        await fetchHistory();
      } else {
        const d = await res.json();
        window.alert(d.error || "Ack failed");
      }
    } catch (e) {
      logClientError(e, "HandoverClient");
    } finally {
      setAckId(null);
    }
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((m) =>
        setIsManager(m?.user?.level === "MANAGER" || m?.user?.isOwner === true),
      )
      .catch(() => {});
  }, []);

  const filteredHandovers = handovers.filter((h) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.productionNotes?.toLowerCase().includes(q) ||
      h.downtimeNotes?.toLowerCase().includes(q) ||
      h.safetyNotes?.toLowerCase().includes(q) ||
      h.nextShiftActions?.toLowerCase().includes(q) ||
      h.missReason?.toLowerCase().includes(q) ||
      h.authorName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-12">
      {/* â”€â”€ WRITE HANDOVER FORM â”€â”€ */}
      <section className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-700 bg-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ClipboardEdit className="w-5 h-5 text-blue-500" />
            Write New Handover
          </h2>
          <button
            type="button"
            onClick={handleAutofill}
            disabled={isAutofilling}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-violet-700 bg-violet-100 text-violet-300 dark:bg-violet-900/40 rounded-lg hover:bg-violet-200 hover:bg-violet-900/60 transition-colors disabled:opacity-50"
          >
            <Wand2
              className={`w-4 h-4 ${isAutofilling ? "animate-spin" : ""}`}
            />
            {isAutofilling
              ? "Gathering Data..."
              : "Auto-fill from today's data"}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          {/* PLAN VS ACTUAL SUMMARY CARD */}
          <div
            className={`p-5 rounded-2xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
              targetMissed
                ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                <h3 className="font-extrabold text-base uppercase tracking-wider">
                  Plan vs Actual Shift Summary
                </h3>
              </div>
              <p className="text-xs opacity-90 font-mono">
                Planned Target:{" "}
                <strong>{totalPlanned.toLocaleString()} pcs</strong> | Actual
                Good Logged: <strong>{totalGood.toLocaleString()} pcs</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-2xl font-black font-mono">
                  {achievementPct}%
                </span>
                <span className="text-[10px] block opacity-75 uppercase">
                  Target Achievement
                </span>
              </div>

              <span
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border shadow-md ${
                  targetMissed
                    ? "bg-rose-600 text-white border-rose-500"
                    : "bg-emerald-600 text-white border-emerald-500"
                }`}
              >
                {targetMissed ? "Target Missed âš ï¸" : "Target Met âœ“"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">
                Shift
              </label>
              <select
                required
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              >
                <option value="">Select Shift...</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.startTime}-{s.endTime})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">
                Author Name *
              </label>
              <input
                type="text"
                required
                placeholder="Supervisor Full Name"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">
                Machine Scope
              </label>
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              >
                <option value="PLANT">entire plant (Whole Shift)</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* MANDATORY MISS REASON FIELD WHEN TARGET IS MISSED */}
          {targetMissed && (
            <div className="p-4 bg-rose-500/10 border-2 border-rose-500/40 rounded-2xl space-y-2">
              <label className="block text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Why did we miss plan? (Mandatory Miss Reason) *
              </label>
              <p className="text-xs text-rose-300">
                Shift output ({totalGood} pcs) is below the 95% target threshold
                of planned output ({totalPlanned} pcs). A miss reason is
                required to submit.
              </p>
              <textarea
                required
                rows={2}
                value={missReason}
                onChange={(e) => setMissReason(e.target.value)}
                placeholder="e.g. Material delayed by 2 hours at CNC Bay, Die broke at 3 PM..."
                className="w-full bg-slate-900 border border-rose-500/50 rounded-xl p-3 text-sm text-white font-medium focus:outline-none focus:border-rose-400"
              />
            </div>
          )}

          {/* TEXTAREAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">
                Production &amp; Output Summary
              </label>
              <textarea
                rows={3}
                placeholder="Summary of completed jobs, units produced, operator updates..."
                value={productionNotes}
                onChange={(e) => setProductionNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">
                Downtime &amp; Maintenance Issues
              </label>
              <textarea
                rows={3}
                placeholder="Unplanned downtime, breakdown reasons, ongoing repairs..."
                value={downtimeNotes}
                onChange={(e) => setDowntimeNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">
                Safety &amp; 5S Incidents
              </label>
              <textarea
                rows={3}
                placeholder="Near misses, PPE compliance, 5S cleanup status..."
                value={safetyNotes}
                onChange={(e) => setSafetyNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">
                Action Items for Next Shift
              </label>
              <textarea
                rows={3}
                placeholder="Pending work orders, tooling setups needed, priority tasks..."
                value={nextShiftActions}
                onChange={(e) => setNextShiftActions(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? "Saving..." : "Save Shift Handover Log"}
            </button>
          </div>
        </form>
      </section>

      {/* â”€â”€ HISTORY LIST â”€â”€ */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-700">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" />
            Handover Logbook History
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search notes, author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-800/60 border border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <select
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
              className="bg-slate-800/60 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none"
            >
              <option value="">All Shifts</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              value={filterMachine}
              onChange={(e) => setFilterMachine(e.target.value)}
              className="bg-slate-800/60 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none"
            >
              <option value="">All Machines</option>
              <option value="PLANT">Entire Plant</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoadingHistory ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading history...
          </div>
        ) : filteredHandovers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 bg-slate-800/60 rounded-xl border border-slate-700">
            No handovers found matching criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredHandovers.map((h) => (
              <div
                key={h.id}
                className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                  <div>
                    <span className="font-bold text-white text-sm">
                      {h.shift?.name || "Shift"}
                    </span>
                    <span className="text-xs text-slate-400 font-mono ml-2">
                      ({new Date(h.date).toLocaleDateString()})
                    </span>
                  </div>
                  <span className="px-2.5 py-1 bg-slate-800/60 rounded-full text-xs font-medium text-slate-600 text-slate-300">
                    {h.machine ? h.machine.name : "Entire Plant"}
                  </span>
                </div>

                {h.missReason && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 space-y-1">
                    <strong className="text-rose-400 font-bold block">
                      âš ï¸ Miss Reason:
                    </strong>
                    <span>{h.missReason}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 text-xs">
                  {h.productionNotes && (
                    <div>
                      <span className="font-bold text-slate-500 uppercase block text-[10px]">
                        Production
                      </span>
                      <p className="text-slate-300 font-medium">
                        {h.productionNotes}
                      </p>
                    </div>
                  )}
                  {h.downtimeNotes && (
                    <div>
                      <span className="font-bold text-slate-500 uppercase block text-[10px]">
                        Downtime
                      </span>
                      <p className="text-slate-300 font-medium">
                        {h.downtimeNotes}
                      </p>
                    </div>
                  )}
                  {h.safetyNotes && (
                    <div>
                      <span className="font-bold text-slate-500 uppercase block text-[10px]">
                        Safety / 5S
                      </span>
                      <p className="text-slate-300 font-medium">
                        {h.safetyNotes}
                      </p>
                    </div>
                  )}
                  {h.nextShiftActions && (
                    <div>
                      <span className="font-bold text-slate-500 uppercase block text-[10px]">
                        Next Shift Actions
                      </span>
                      <p className="text-slate-300 font-medium">
                        {h.nextShiftActions}
                      </p>
                    </div>
                  )}
                </div>

                {(h.openBreakdowns && h.openBreakdowns.length > 0) ||
                (h.openNcrs && h.openNcrs.length > 0) ? (
                  <div className="space-y-1.5 pt-1">
                    {h.openBreakdowns && h.openBreakdowns.length > 0 && (
                      <div className="text-[10px] font-bold uppercase text-slate-500">
                        Open breakdowns at write ({h.openBreakdowns.length})
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {(h.openBreakdowns || []).map((b: any, i: number) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-[10px] rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2 py-0.5"
                        >
                          <Wrench className="w-2.5 h-2.5" />{" "}
                          {(b.title || b.description || "Breakdown").slice(
                            0,
                            40,
                          )}
                        </span>
                      ))}
                      {(h.openNcrs || []).map((n: any, i: number) => (
                        <span
                          key={`n${i}`}
                          className="inline-flex items-center gap-1 text-[10px] rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5"
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />{" "}
                          {n.ncrNumber} · {n.severity}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {h.acknowledgedAt ? (
                  <div className="pt-2 border-t border-slate-700 flex items-center gap-2 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300 font-semibold">
                      Acknowledged by {h.acknowledgedBy}
                    </span>
                    <span className="text-slate-500">
                      · {new Date(h.acknowledgedAt).toLocaleString()}
                    </span>
                  </div>
                ) : isManager ? (
                  <div className="pt-2 border-t border-slate-700">
                    <button
                      onClick={() => handleAck(h)}
                      disabled={ackId === h.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/40 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
                    >
                      <CheckCircle2 className="w-3 h-3" />{" "}
                      {ackId === h.id
                        ? "Acknowledging…"
                        : "Acknowledge (incoming supervisor)"}
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-700 text-[11px] text-amber-300 font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Awaiting acknowledgement
                  </div>
                )}

                <div className="pt-3 border-t border-slate-700 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 font-medium">
                    <User className="w-3.5 h-3.5 text-slate-500" />{" "}
                    {h.authorName}
                  </span>
                  <div className="flex items-center gap-3">
                    <span>
                      {new Date(h.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <SourceRecordEditModal
                      entityType="ShiftHandover"
                      entityId={h.id}
                      title="Shift Handover Record"
                      fields={[
                        {
                          key: "productionNotes",
                          label: "Production Notes",
                          type: "text",
                        },
                        {
                          key: "downtimeNotes",
                          label: "Downtime Notes",
                          type: "text",
                        },
                        {
                          key: "safetyNotes",
                          label: "Safety / 5S Notes",
                          type: "text",
                        },
                        {
                          key: "nextShiftActions",
                          label: "Next Shift Actions",
                          type: "text",
                        },
                        {
                          key: "missReason",
                          label: "Miss Reason",
                          type: "text",
                        },
                      ]}
                      initialValues={{
                        productionNotes: h.productionNotes,
                        downtimeNotes: h.downtimeNotes,
                        safetyNotes: h.safetyNotes,
                        nextShiftActions: h.nextShiftActions,
                        missReason: h.missReason,
                      }}
                      onSaved={fetchHistory}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
