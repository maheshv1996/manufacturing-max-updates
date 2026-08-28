"use client";

import { useState, useEffect } from "react";
import {
  ClipboardCheck,
  Trophy,
  Calendar,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";

const CATEGORIES = [
  {
    key: "SORT",
    label: "1S â€” Sort (Seiri)",
    desc: "Eliminate unneeded items from the workspace",
  },
  {
    key: "SET_IN_ORDER",
    label: "2S â€” Set in Order (Seiton)",
    desc: "Organize items so they are easy to find and use",
  },
  {
    key: "SHINE",
    label: "3S â€” Shine (Seiso)",
    desc: "Clean and inspect the workplace systematically",
  },
  {
    key: "STANDARDIZE",
    label: "4S â€” Standardize (Seiketsu)",
    desc: "Establish standards and visual controls for 1S-3S",
  },
  {
    key: "SUSTAIN",
    label: "5S â€” Sustain (Shitsuke)",
    desc: "Maintain standards through discipline and routine audits",
  },
];

export default function FiveSClient() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // New Audit Form State
  const [area, setArea] = useState<string>("CNC Bay");
  const [customArea, setCustomArea] = useState<string>("");
  const [isCustomArea, setIsCustomArea] = useState<boolean>(false);
  const [auditorName, setAuditorName] = useState<string>("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<string>("");

  // Audit Detail Modal
  const [selectedAudit, setSelectedAudit] = useState<any | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/fives");
      if (res.ok) {
        const json = await res.json();
        setData(json);

        // Pre-fill item scores with default 4s
        const defaultScores: Record<string, number> = {};
        (json.items || []).forEach((item: any) => {
          defaultScores[item.id] = 4;
        });
        setScores(defaultScores);

        if (json.existingAreas && json.existingAreas.length > 0) {
          setArea(json.existingAreas[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch 5S data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const items: any[] = data?.items || [];
  const audits: any[] = data?.audits || [];
  const areaRankings: any[] = data?.areaRankings || [];
  const existingAreas: string[] = data?.existingAreas || [];

  // Live Score Calculation
  const totalPoints = Object.values(scores).reduce((sum, val) => sum + val, 0);
  const maxPossible = (items.length || 15) * 5;
  const liveTotalPct =
    items.length > 0
      ? Number(((totalPoints / maxPossible) * 100).toFixed(1))
      : 0;

  const handleScoreChange = (itemId: string, scoreVal: number) => {
    setScores((prev) => ({ ...prev, [itemId]: scoreVal }));
  };

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalArea = isCustomArea ? customArea.trim() : area.trim();

    if (!finalArea || !auditorName.trim()) {
      return alert("Please enter both the area and auditor name.");
    }

    setSaving(true);

    try {
      const scoresPayload = Object.entries(scores).map(([itemId, score]) => ({
        itemId,
        score,
      }));

      const res = await fetch("/api/fives/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: finalArea,
          auditorName: auditorName.trim(),
          notes,
          scores: scoresPayload,
        }),
      });

      if (res.ok) {
        alert("5S Audit saved successfully!");
        setNotes("");
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save audit");
      }
    } catch (err) {
      alert("Failed to save audit");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* AREA RANKINGS & TOP METRICS */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEADERBOARD CARD */}
        <div className="lg:col-span-2 bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              5S Area Ranking Board
            </h2>
            <span className="text-xs text-slate-400">
              Ranked by historical audit averages
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {areaRankings.map((rk) => {
              const medal =
                rk.rank === 1
                  ? "ðŸ¥‡"
                  : rk.rank === 2
                    ? "ðŸ¥ˆ"
                    : rk.rank === 3
                      ? "ðŸ¥‰"
                      : `#${rk.rank}`;

              return (
                <div
                  key={rk.area}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                    rk.rank === 1
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                      : rk.rank === 2
                        ? "bg-slate-500/10 border-slate-500/30 text-slate-200"
                        : rk.rank === 3
                          ? "bg-orange-500/10 border-orange-500/30 text-orange-200"
                          : "bg-slate-800/60 border-slate-600/80 text-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{medal}</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/10">
                      {rk.count} audit(s)
                    </span>
                  </div>

                  <div className="mt-3">
                    <h3 className="font-extrabold text-base truncate">
                      {rk.area}
                    </h3>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-xs opacity-75">Avg Score:</span>
                      <span className="text-2xl font-black font-mono">
                        {rk.avgPct}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5S SUMMARY INFO CARD */}
        <div className="bg-gradient-to-br from-blue-900/40 via-slate-900 to-indigo-950/60 border border-blue-800/50 rounded-2xl p-6 text-white shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-bold font-mono">
              Lean 5S Discipline
            </span>
            <h3 className="text-2xl font-black">Visual Workplace Excellence</h3>
            <p className="text-xs text-blue-200/80 leading-relaxed">
              Standardize operational hygiene, eliminate waste, improve safety,
              and track compliance across factory areas.
            </p>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs space-y-1 font-mono">
            <div className="flex justify-between text-slate-300">
              <span>Total Audits Logged:</span>
              <strong className="text-white">{audits.length}</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Checklist Criteria:</span>
              <strong className="text-emerald-400">{items.length} Items</strong>
            </div>
          </div>
        </div>
      </section>

      {/* NEW 5S AUDIT FORM */}
      <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-sm space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-6">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <ClipboardCheck className="w-7 h-7 text-emerald-500" />
              Conduct New 5S Audit
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Score each item from 1 (Poor) to 5 (World Class). Total score %
              updates live.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-800/60 p-3 rounded-2xl border border-slate-600">
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Live Audit Score
              </span>
              <span className="text-3xl font-black font-mono text-emerald-500">
                {liveTotalPct}%
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveAudit} className="space-y-8">
          {/* Header Inputs: Area & Auditor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-200 mb-2">
                Select Audit Area *
              </label>
              <div className="space-y-2">
                <select
                  disabled={isCustomArea}
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none disabled:opacity-50"
                >
                  {existingAreas.map((a) => (
                    <option key={a} value={a}>
                      ðŸ“ {a}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="customAreaCheck"
                    checked={isCustomArea}
                    onChange={(e) => setIsCustomArea(e.target.checked)}
                    className="rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="customAreaCheck"
                    className="text-xs text-slate-500 cursor-pointer"
                  >
                    Enter new custom area
                  </label>
                </div>

                {isCustomArea && (
                  <input
                    type="text"
                    required
                    value={customArea}
                    onChange={(e) => setCustomArea(e.target.value)}
                    placeholder="Enter custom area name (e.g. Chemical Shop)"
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-2 text-sm text-white focus:outline-none"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-200 mb-2">
                Auditor Name *
              </label>
              <input
                type="text"
                required
                value={auditorName}
                onChange={(e) => setAuditorName(e.target.value)}
                placeholder="Enter auditor full name (e.g. Sarah Jenkins)"
                className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none"
              />
            </div>
          </div>

          {/* CHECKLIST ITEMS GROUPED BY 5S CATEGORY */}
          <div className="space-y-8">
            {CATEGORIES.map((cat) => {
              const catItems = items.filter((i) => i.category === cat.key);
              if (catItems.length === 0) return null;

              return (
                <div
                  key={cat.key}
                  className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-4"
                >
                  <div>
                    <h3 className="text-lg font-black text-white">
                      {cat.label}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{cat.desc}</p>
                  </div>

                  <div className="space-y-3">
                    {catItems.map((item) => {
                      const currentScore = scores[item.id] || 4;

                      return (
                        <div
                          key={item.id}
                          className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="text-sm font-bold text-slate-200 max-w-xl">
                            {item.text}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {[1, 2, 3, 4, 5].map((val) => {
                              const isSelected = currentScore === val;
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() =>
                                    handleScoreChange(item.id, val)
                                  }
                                  className={`w-10 h-10 rounded-xl font-bold font-mono text-sm transition-all cursor-pointer ${
                                    isSelected
                                      ? val >= 4
                                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-105"
                                        : val === 3
                                          ? "bg-amber-500 text-white shadow-md shadow-amber-500/30 scale-105"
                                          : "bg-rose-600 text-white shadow-md shadow-rose-600/30 scale-105"
                                      : "bg-slate-800/60 text-slate-400 hover:bg-slate-200 hover:bg-slate-700"
                                  }`}
                                >
                                  {val}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Notes & Submit */}
          <div className="space-y-4 pt-4 border-t border-slate-700">
            <div>
              <label className="block text-sm font-bold text-slate-200 mb-1">
                Audit Notes &amp; Corrective Action Items (Optional)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Record specific observations, missed items, or required corrective actions..."
                className="w-full bg-slate-800/60 border border-slate-600 rounded-xl p-3 text-sm text-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white text-base font-extrabold rounded-2xl shadow-xl shadow-emerald-600/30 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Saving Audit...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" /> Submit 5S Audit (
                    {liveTotalPct}%)
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* 5S AUDIT HISTORY LIST */}
      <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-700 pb-4">
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-3">
              <Calendar className="w-6 h-6 text-blue-500" />
              Audit Log History ({audits.length})
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Historical 5S audit logs across factory bays. Click any audit to
              inspect score details.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {audits.map((a) => {
            const scoreColor =
              a.totalPct >= 90
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : a.totalPct >= 75
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                  : a.totalPct >= 60
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20";

            return (
              <div
                key={a.id}
                onClick={() => setSelectedAudit(a)}
                className="bg-slate-800/60 border border-slate-600/80 rounded-2xl p-5 space-y-3 cursor-pointer hover:border-blue-500 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-white text-base">
                    ðŸ“ {a.area}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black font-mono border ${scoreColor}`}
                  >
                    {a.totalPct}%
                  </span>
                </div>

                <div className="text-xs text-slate-400 space-y-1 font-mono">
                  <div>
                    Auditor:{" "}
                    <span className="font-semibold text-slate-200">
                      {a.auditorName}
                    </span>
                  </div>
                  <div>
                    Date: {new Date(a.date).toLocaleDateString()}{" "}
                    {new Date(a.date).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                {a.notes && (
                  <p className="text-xs text-slate-400 italic line-clamp-2 border-t border-slate-600/60 pt-2">
                    &ldquo;{a.notes}&rdquo;
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* AUDIT DETAILS INSPECTION MODAL */}
      {selectedAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  ðŸ“ {selectedAudit.area} 5S Audit
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Auditor:{" "}
                  <strong className="text-white">
                    {selectedAudit.auditorName}
                  </strong>{" "}
                  â€¢ {new Date(selectedAudit.date).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedAudit(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl">
              <span className="text-sm font-bold text-slate-300">
                Overall Audit Score
              </span>
              <span className="text-3xl font-black font-mono text-emerald-400">
                {selectedAudit.totalPct}%
              </span>
            </div>

            {selectedAudit.notes && (
              <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700 text-xs text-slate-300">
                <strong>Notes:</strong> {selectedAudit.notes}
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                Item Score Breakdown
              </h4>
              <div className="space-y-2">
                {(selectedAudit.scores || []).map((sc: any) => (
                  <div
                    key={sc.id}
                    className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-800 text-xs"
                  >
                    <span className="text-slate-300 font-medium">
                      {sc.item?.text || "Checklist Item"}
                    </span>
                    <span
                      className={`font-black font-mono px-2.5 py-0.5 rounded ${
                        sc.score >= 4
                          ? "bg-emerald-500/20 text-emerald-300"
                          : sc.score === 3
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-rose-500/20 text-rose-300"
                      }`}
                    >
                      {sc.score} / 5
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
