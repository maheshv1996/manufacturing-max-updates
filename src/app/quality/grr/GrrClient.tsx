"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect, useCallback } from "react";
import { Ruler, Plus, Loader2, X, Trash2, FlaskConical } from "lucide-react";
import { computeGrr, grrVerdictLabel } from "@/lib/grr";

type Study = any;

const VERDICT_CLS: Record<string, string> = {
  ACCEPTABLE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  CONDITIONAL: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  UNACCEPTABLE: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
};

interface Cell {
  appraiser: string;
  part: number;
  trial: number;
  value: string;
}

export default function GrrClient() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [tools, setTools] = useState<
    { id: string; name: string; serialNumber: string; toolType: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toolId, setToolId] = useState("");
  const [nAppraisers, setNAppraisers] = useState(3);
  const [nParts, setNParts] = useState(5);
  const [nTrials, setNTrials] = useState(3);
  const [appraiserNames, setAppraiserNames] = useState<string[]>([
    "A",
    "B",
    "C",
  ]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [notes, setNotes] = useState("");
  const [liveResult, setLiveResult] = useState<any>(null);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/grr");
      if (res.ok) {
        const d = await res.json();
        setStudies(d.studies || []);
        setTools(d.tools || []);
        if (!toolId && d.tools?.[0]) setToolId(d.tools[0].id);
      }
    } catch (e) {
      logClientError(e, "GrrClient");
    } finally {
      setLoading(false);
    }
  }, [toolId]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initGrid = (na: number, np: number, nt: number) => {
    const names = Array.from({ length: na }, (_, i) =>
      String.fromCharCode(65 + i),
    );
    setAppraiserNames(names);
    const c: Cell[] = [];
    for (let a = 0; a < na; a++) {
      for (let p = 1; p <= np; p++) {
        for (let t = 1; t <= nt; t++) {
          c.push({ appraiser: names[a], part: p, trial: t, value: "" });
        }
      }
    }
    setCells(c);
  };

  const startCreate = () => {
    initGrid(nAppraisers, nParts, nTrials);
    setNotes("");
    setLiveResult(null);
    setError("");
    setCreating(true);
  };

  const setCell = (idx: number, value: string) => {
    const next = [...cells];
    next[idx] = { ...next[idx], value };
    setCells(next);
  };

  const computeLive = () => {
    const measurements = cells
      .filter((c) => c.value !== "")
      .map((c) => ({
        appraiser: c.appraiser,
        part: c.part,
        trial: c.trial,
        value: parseFloat(c.value),
      }));
    if (measurements.length < 8) {
      setError(
        "Enter at least 8 measurements (min 2 appraisers Ã— 2 parts Ã— 2 trials).",
      );
      setLiveResult(null);
      return;
    }
    try {
      setLiveResult(computeGrr(measurements));
      setError("");
    } catch (e) {
      logClientError(e, "GrrClient");
    }
  };

  const save = async () => {
    const measurements = cells
      .filter((c) => c.value !== "")
      .map((c) => ({
        appraiser: c.appraiser,
        part: c.part,
        trial: c.trial,
        value: parseFloat(c.value),
      }));
    if (!toolId) return alert("Select a calibrated tool");
    if (measurements.length < 8) return alert("Enter at least 8 measurements");
    setSaving(true);
    try {
      const res = await fetch("/api/grr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            toolId,
            appraisers: nAppraisers,
            parts: nParts,
            trials: nTrials,
            measurements,
            notes,
          },
        }),
      });
      const d = await res.json();
      if (!res.ok) alert(d.error || "Failed to save study");
      else {
        setCreating(false);
        await fetchData();
      }
    } catch (e) {
      logClientError(e, "GrrClient");
      alert("Failed to save study");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this Gage R&R study?")) return;
    await fetch("/api/grr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "delete", data: { id } }),
    });
    fetchData();
  };

  const input =
    "w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm";

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            Gage R&R â€” Measurement System Analysis
          </h2>
          <p className="text-slate-400 text-sm">
            Repeatability & reproducibility studies on calibrated tooling (AIAG
            average-range method): %GRR, NDC, and verdict.
          </p>
        </div>
        <button
          onClick={startCreate}
          disabled={saving || tools.length === 0}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> New Study
        </button>
      </div>

      {/* STUDIES TABLE */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/60 border-b border-slate-700">
              <tr>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Study
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">Tool</th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Design
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">%GRR</th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  EV / AV
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">NDC</th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Verdict
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200">
                  Conducted
                </th>
                <th className="px-5 py-3 font-semibold text-slate-200 text-right">
                  Delete
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800">
              {studies.map((s) => (
                <tr key={s.id} className="hover:bg-slate-800/90/20">
                  <td className="px-5 py-3 font-mono font-bold text-white">
                    {s.studyNumber}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-medium">{s.tool?.name}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {s.tool?.serialNumber}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 text-slate-300">
                    {s.appraisers} appr Ã— {s.parts} parts Ã— {s.trials} trials
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-sm font-black font-mono ${s.result?.grrPct <= 10 ? "text-emerald-500" : s.result?.grrPct <= 30 ? "text-amber-500" : "text-rose-500"}`}
                    >
                      {s.result?.grrPct ?? s.grrPct ?? "â€”"}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs font-mono text-slate-500">
                    EV {s.result?.ev ?? s.ev ?? "â€”"} / AV{" "}
                    {s.result?.av ?? s.av ?? "â€”"}
                  </td>
                  <td className="px-5 py-3 font-mono">
                    {s.result?.ndc ?? s.ndc ?? "â€”"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${VERDICT_CLS[s.result?.verdict ?? s.verdict] || VERDICT_CLS.CONDITIONAL}`}
                    >
                      {grrVerdictLabel(s.result?.verdict ?? s.verdict)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {new Date(s.conductedAt).toLocaleDateString()}
                    <div className="text-[10px]">{s.conductedBy}</div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => remove(s.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {studies.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-10 text-center text-slate-400 italic"
                  >
                    No studies yet. Run one on a calibrated tool.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE MODAL */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl bg-slate-800/60 rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800/60 z-10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Ruler className="w-5 h-5 text-blue-500" /> New Gage R&R Study
              </h3>
              <button
                onClick={() => setCreating(false)}
                className="p-2 rounded-lg hover:bg-slate-800/90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* DESIGN */}
              <div className="grid sm:grid-cols-4 gap-4">
                <Field label="Calibrated Tool">
                  <select
                    className={input}
                    value={toolId}
                    onChange={(e) => setToolId(e.target.value)}
                  >
                    {tools.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.serialNumber})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Appraisers">
                  <input
                    type="number"
                    min={2}
                    max={5}
                    className={input}
                    value={nAppraisers}
                    onChange={(e) =>
                      setNAppraisers(Number(e.target.value) || 2)
                    }
                  />
                </Field>
                <Field label="Parts">
                  <input
                    type="number"
                    min={2}
                    max={10}
                    className={input}
                    value={nParts}
                    onChange={(e) => setNParts(Number(e.target.value) || 2)}
                  />
                </Field>
                <Field label="Trials">
                  <input
                    type="number"
                    min={2}
                    max={3}
                    className={input}
                    value={nTrials}
                    onChange={(e) => setNTrials(Number(e.target.value) || 2)}
                  />
                </Field>
              </div>
              <button
                onClick={() => initGrid(nAppraisers, nParts, nTrials)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
              >
                Reset Grid
              </button>

              {/* MEASUREMENT GRID */}
              <div className="overflow-x-auto">
                <table className="w-full text-center text-sm border border-slate-700">
                  <thead>
                    <tr>
                      <th className="p-2 bg-slate-800/60 border border-slate-700 text-left font-semibold">
                        Appraiser \ Part
                      </th>
                      {Array.from({ length: nParts }, (_, i) => (
                        <th
                          key={i}
                          colSpan={nTrials}
                          className="p-2 bg-slate-800/60 border border-slate-700 font-semibold"
                        >
                          Part {i + 1}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      <th className="p-1 bg-slate-800/60 border border-slate-700" />
                      {Array.from({ length: nParts }, (_, i) => (
                        <th
                          key={i}
                          colSpan={nTrials}
                          className="p-1 text-[10px] font-mono text-slate-500 border border-slate-700"
                        >
                          T1 Â· T2 Â· T3
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {appraiserNames.map((name) => {
                      const rowIdx = cells.findIndex(
                        (c) =>
                          c.appraiser === name && c.part === 1 && c.trial === 1,
                      );
                      return (
                        <tr key={name}>
                          <td className="p-2 border border-slate-700 font-bold text-blue-500">
                            {name}
                          </td>
                          {Array.from({ length: nParts }, (_, p) => (
                            <td key={p} className="p-1 border border-slate-700">
                              <div className="flex gap-1 justify-center">
                                {Array.from({ length: nTrials }, (_, t) => {
                                  const idx = rowIdx + p * nTrials + t;
                                  return (
                                    <input
                                      key={t}
                                      type="number"
                                      step="any"
                                      className="w-16 text-center bg-slate-800/60 border border-slate-600 rounded px-1 py-1.5 text-sm font-mono"
                                      value={cells[idx]?.value || ""}
                                      onChange={(e) =>
                                        setCell(idx, e.target.value)
                                      }
                                    />
                                  );
                                })}
                              </div>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* LIVE RESULT */}
              <div className="flex items-center gap-2">
                <button
                  onClick={computeLive}
                  className="text-sm font-bold px-4 py-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/30 inline-flex items-center gap-2"
                >
                  <FlaskConical className="w-4 h-4" /> Compute %GRR
                </button>
                {error && (
                  <span className="text-xs text-rose-500">{error}</span>
                )}
              </div>
              {liveResult && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <Stat label="EV" value={liveResult.ev} />
                  <Stat label="AV" value={liveResult.av} />
                  <Stat label="GRR" value={liveResult.grr} />
                  <Stat label="Part Var" value={liveResult.partVar} />
                  <Stat
                    label="%GRR"
                    value={`${liveResult.grrPct}%`}
                    accent={
                      liveResult.grrPct <= 10
                        ? "text-emerald-500"
                        : liveResult.grrPct <= 30
                          ? "text-amber-500"
                          : "text-rose-500"
                    }
                  />
                  <Stat label="NDC" value={liveResult.ndc} />
                </div>
              )}
              {liveResult && (
                <div
                  className={`p-4 rounded-xl border ${liveResult.verdict === "ACCEPTABLE" ? "bg-emerald-500/10 border-emerald-500/30" : liveResult.verdict === "CONDITIONAL" ? "bg-amber-500/10 border-amber-500/30" : "bg-rose-500/10 border-rose-500/30"}`}
                >
                  <div className="text-sm font-bold text-white mb-1">
                    Verdict: {grrVerdictLabel(liveResult.verdict)}
                  </div>
                  <p className="text-xs text-slate-600 text-slate-300">
                    {liveResult.messages?.[0]}
                  </p>
                </div>
              )}

              <Field label="Notes">
                <textarea
                  rows={2}
                  className={input}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. CMM #2, part A-101 bore, appraisers A/B/C"
                />
              </Field>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setCreating(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800/60 text-slate-600 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving || !liveResult}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}{" "}
                  Save Study
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: any;
  accent?: string;
}) {
  return (
    <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-600">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`text-lg font-black font-mono ${accent || "text-white"}`}>
        {value ?? "â€”"}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
