"use client";

import { useCallback, useEffect, useState } from "react";
import { Award, Loader2, Star, Printer } from "lucide-react";
import { Button, Input } from "@/app/components/ui";

interface Row {
  id: string;
  name: string;
  employeeNumber: string | null;
  efficiencyPct: number;
  qualityPct: number;
  attendancePct: number;
  score: number;
  goodUnits: number;
  scrapUnits: number;
  stored: {
    status: string;
    managerRating: number | null;
    managerComments: string | null;
    reviewedByName: string | null;
    reviewedAt: string | null;
  } | null;
}

export default function AppraisalsClient() {
  const [period, setPeriod] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [reviewFor, setReviewFor] = useState<Row | null>(null);
  const [rating, setRating] = useState("4");
  const [comments, setComments] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/appraisals?period=${period}`);
      const data = await res.json();
      setRows(data.rows || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const review = async () => {
    if (!reviewFor) return;
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/appraisals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          data: { userId: reviewFor.id, period, rating, comments },
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setMsg(
          `Appraisal reviewed for ${reviewFor.name} — score ${reviewFor.score}, rating ${rating}.`,
        );
        setReviewFor(null);
        await fetchAll();
      } else {
        setMsg(d.error || "Review failed");
      }
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(false);
    }
  };

  const scoreColor = (s: number) =>
    s >= 90
      ? "text-emerald-400"
      : s >= 80
        ? "text-sky-400"
        : s >= 70
          ? "text-amber-400"
          : "text-rose-400";

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-emerald-300 font-semibold">{msg}</p>}

      {/* Period picker */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-white">Period</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Auto-score = 40% efficiency (standard hrs vs actual) + 40% quality
            (100 − scrap rate) + 20% attendance. Managers add the 1–5 rating.
          </p>
        </div>
        <Input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="w-44"
        />
      </div>

      {/* Leaderboard */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" />
          <h3 className="font-bold text-white">Operator scores — {period}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                <th className="px-5 py-3">#</th>
                <th className="px-3 py-3">Operator</th>
                <th className="px-3 py-3 text-right">Efficiency</th>
                <th className="px-3 py-3 text-right">Quality</th>
                <th className="px-3 py-3 text-right">Attendance</th>
                <th className="px-3 py-3 text-right">Score</th>
                <th className="px-3 py-3">Manager rating</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-5 py-3 text-slate-500 font-bold">
                    {i + 1}
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-bold text-white">{r.name}</span>
                    {r.employeeNumber && (
                      <span className="block text-[11px] text-slate-500">
                        {r.employeeNumber}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-300 tabular-nums">
                    {r.efficiencyPct}%
                  </td>
                  <td className="px-3 py-3 text-right text-slate-300 tabular-nums">
                    {r.qualityPct}%
                  </td>
                  <td className="px-3 py-3 text-right text-slate-300 tabular-nums">
                    {r.attendancePct}%
                  </td>
                  <td
                    className={`px-3 py-3 text-right font-black tabular-nums ${scoreColor(r.score)}`}
                  >
                    {r.score}
                  </td>
                  <td className="px-3 py-3">
                    {r.stored?.managerRating ? (
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        {Array.from({ length: r.stored.managerRating }).map(
                          (_, j) => (
                            <Star
                              key={j}
                              className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                            />
                          ),
                        )}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`text-[10px] font-bold rounded-full border px-2 py-0.5 ${r.stored?.status === "REVIEWED" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : "bg-slate-700/50 text-slate-400 border-slate-600"}`}
                    >
                      {r.stored?.status === "REVIEWED" ? "REVIEWED" : "AUTO"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setReviewFor(r);
                          setRating(String(r.stored?.managerRating || 4));
                          setComments(r.stored?.managerComments || "");
                        }}
                        className="rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/40 px-2 py-1 text-[11px] font-semibold hover:bg-amber-500/25"
                      >
                        <Star className="w-3 h-3 inline mr-0.5" /> Review
                      </button>
                      {r.stored?.status === "REVIEWED" && (
                        <a
                          href={`/reports/appraisal/${r.id}?period=${period}`}
                          target="_blank"
                          className="rounded-lg bg-white/5 text-slate-300 border border-slate-600 px-2 py-1 text-[11px] font-semibold hover:bg-white/10"
                        >
                          <Printer className="w-3 h-3 inline mr-0.5" /> Print
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-8 text-center text-sm text-slate-500"
                  >
                    No operators found for {period}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review modal */}
      {reviewFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4">
            <h3 className="font-bold text-white">
              Manager review — {reviewFor.name}
            </h3>
            <p className="text-xs text-slate-400">
              Auto score {reviewFor.score} (eff {reviewFor.efficiencyPct}% ·
              qual {reviewFor.qualityPct}% · att {reviewFor.attendancePct}%) ·{" "}
              {reviewFor.goodUnits} good / {reviewFor.scrapUnits} scrap units
            </p>
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                Rating (1–5)
              </label>
              <div className="mt-1.5 flex gap-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => setRating(String(v))}
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${Number(rating) === v ? "bg-amber-500/20 text-amber-300 border-amber-500/50" : "border-slate-700 text-slate-400 hover:border-slate-600"}`}
                  >
                    <Star
                      className={`w-4 h-4 ${Number(rating) >= v ? "fill-amber-400 text-amber-400" : ""}`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">
                Comments
              </label>
              <Input
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Strengths, areas to develop, commitments…"
                className="mt-1.5"
              />
            </div>
            <Button disabled={busy} onClick={review} className="w-full">
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Star className="w-4 h-4" />
              )}{" "}
              Save review
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
