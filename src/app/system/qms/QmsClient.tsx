"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardCheck,
  AlertTriangle,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
} from "lucide-react";

type Audit = any;
type Finding = any;

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
  IN_PROGRESS: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  COMPLETED: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  OPEN: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
  F_IN_PROGRESS: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  CLOSED: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  MINOR: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  MAJOR: "bg-orange-500/10 text-orange-400 border border-orange-500/30",
  CRITICAL: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
  PASS: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  PASS_WITH_FINDINGS:
    "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  FAIL: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
};

const badge = (k: string) =>
  STATUS_COLORS[k] ||
  "bg-slate-500/10 text-slate-400 border border-slate-500/30";

interface Field {
  key: string;
  label: string;
  type?: "text" | "date" | "select" | "textarea";
  options?: (string | { value: string; label: string })[];
  required?: boolean;
  placeholder?: string;
}

function FieldInput({
  field,
  form,
  setForm,
}: {
  field: Field;
  form: any;
  setForm: (f: any) => void;
}) {
  const cls =
    "w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white";
  if (field.type === "select") {
    return (
      <select
        required={field.required}
        value={form[field.key] ?? ""}
        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
        className={cls}
      >
        {(field.options || []).map((o) => {
          const val = typeof o === "string" ? o : o.value;
          const lab = typeof o === "string" ? o : o.label;
          return (
            <option key={val} value={val}>
              {lab}
            </option>
          );
        })}
      </select>
    );
  }
  if (field.type === "textarea") {
    return (
      <textarea
        required={field.required}
        value={form[field.key] ?? ""}
        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
        rows={3}
        className={cls}
      />
    );
  }
  return (
    <input
      required={field.required}
      type={field.type || "text"}
      value={form[field.key] ?? ""}
      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
      placeholder={field.placeholder}
      className={cls}
    />
  );
}

export default function QmsClient() {
  const [tab, setTab] = useState<"audits" | "findings">("audits");
  const [audits, setAudits] = useState<Audit[]>([]);
  const [ncrs, setNcrs] = useState<
    { id: string; ncrNumber: string; status: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<{ entity: string; row: any } | null>(null);
  const [form, setForm] = useState<any>({});
  const [completeModal, setCompleteModal] = useState<Audit | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/qms");
      if (res.ok) {
        const d = await res.json();
        setAudits(d.audits || []);
        setNcrs(d.ncrs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const api = async (entity: string, action: string, data: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/qms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, action, data }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) alert(d.error || "Action failed");
      else await fetchData();
    } catch (e) {
      console.error(e);
      alert("Action failed");
    } finally {
      setSaving(false);
    }
  };

  const openModal = (entity: string, row: any, fields: Field[]) => {
    const init: any = {};
    for (const f of fields) {
      let v = row?.[f.key];
      if (f.type === "date" && v) v = new Date(v).toISOString().slice(0, 10);
      if (f.type === "select" && f.options && v === undefined) {
        const first = f.options[0];
        v = typeof first === "string" ? first : first.value;
      }
      init[f.key] = v ?? "";
    }
    setForm(init);
    setModal({ entity, row });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    const payload: any = { ...form };
    if (modal.row) payload.id = modal.row.id;
    await api(modal.entity, modal.row ? "update" : "create", payload);
    setModal(null);
  };

  const del = async (entity: string, row: any) => {
    if (!confirm("Delete this record? This cannot be undone.")) return;
    await api(entity, "delete", { id: row.id });
  };

  const AUDIT_FIELDS: Field[] = [
    {
      key: "auditNumber",
      label: "Audit Number",
      placeholder: "Auto if blank (AUD-YYYY-###)",
    },
    {
      key: "title",
      label: "Audit Title",
      required: true,
      placeholder: "e.g. Annual AS9100 Surveillance",
    },
    {
      key: "standard",
      label: "Standard",
      type: "select",
      options: ["AS9100", "ISO9001", "ISO14001", "OTHER"],
    },
    {
      key: "auditType",
      label: "Type",
      type: "select",
      options: ["INTERNAL", "CUSTOMER", "SURVEILLANCE", "EXTERNAL"],
    },
    { key: "auditor", label: "Lead Auditor" },
    { key: "auditeeDept", label: "Auditee Department" },
    { key: "scheduledDate", label: "Scheduled Date", type: "date" },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["PLANNED", "IN_PROGRESS", "COMPLETED"],
    },
    {
      key: "result",
      label: "Result",
      type: "select",
      options: ["", "PASS", "PASS_WITH_FINDINGS", "FAIL"],
    },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const FINDING_FIELDS: Field[] = [
    {
      key: "auditId",
      label: "Audit",
      type: "select",
      options: [
        { value: "", label: "Select audit" },
        ...audits.map((a) => ({
          value: a.id,
          label: `${a.auditNumber} â€” ${a.title}`,
        })),
      ],
    },
    {
      key: "clause",
      label: "Clause",
      required: true,
      placeholder: "e.g. AS9100D 8.4.1",
    },
    {
      key: "description",
      label: "Description",
      required: true,
      type: "textarea",
    },
    {
      key: "severity",
      label: "Severity",
      type: "select",
      options: ["MINOR", "MAJOR", "CRITICAL"],
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["OPEN", "IN_PROGRESS", "CLOSED"],
    },
    { key: "correctiveAction", label: "Corrective Action", type: "textarea" },
    {
      key: "ncrId",
      label: "Linked NCR",
      type: "select",
      options: [
        { value: "", label: "None" },
        ...ncrs.map((n) => ({
          value: n.id,
          label: `${n.ncrNumber} (${n.status})`,
        })),
      ],
    },
    { key: "dueDate", label: "Due Date", type: "date" },
  ];

  const allFindings = audits.flatMap((a) =>
    (a.findings || []).map((f: Finding) => ({ ...f, _audit: a })),
  );
  const openFindings = allFindings.filter((f) => f.status !== "CLOSED");

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap print:hidden">
        <button
          onClick={() => setTab("audits")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            tab === "audits"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-800/60 text-slate-600 text-slate-300 hover:bg-slate-200 hover:bg-slate-700 border border-slate-600"
          }`}
        >
          <ClipboardCheck className="w-4 h-4" /> Audit Schedule
        </button>
        <button
          onClick={() => setTab("findings")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            tab === "findings"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-800/60 text-slate-600 text-slate-300 hover:bg-slate-200 hover:bg-slate-700 border border-slate-600"
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> Findings ({openFindings.length}{" "}
          open)
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : tab === "audits" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openModal("audits", null, AUDIT_FIELDS)}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Schedule Audit
            </button>
          </div>
          <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-800/60 border-b border-slate-700">
                <tr>
                  {[
                    "Audit",
                    "Standard",
                    "Type",
                    "Auditor",
                    "Dept",
                    "Scheduled",
                    "Status",
                    "Result",
                    "Findings",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3.5 font-semibold text-slate-200"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 divide-slate-800">
                {audits.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-5 py-10 text-center text-slate-400 italic"
                    >
                      No audits scheduled.
                    </td>
                  </tr>
                )}
                {audits.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-slate-800/90/20 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="font-bold text-white">
                        {a.auditNumber}
                      </div>
                      <div className="text-xs text-slate-400">{a.title}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-slate-300">
                      {a.standard}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-slate-300">
                      {a.auditType}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-slate-300">
                      {a.auditor || "â€”"}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-slate-300">
                      {a.auditeeDept || "â€”"}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-slate-300">
                      {new Date(a.scheduledDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${badge(a.status)}`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {a.result ? (
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${badge(a.result)}`}
                        >
                          {a.result}
                        </span>
                      ) : (
                        "â€”"
                      )}
                    </td>
                    <td className="px-5 py-3 font-bold text-slate-300">
                      {a.findings?.length || 0}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        {a.status !== "COMPLETED" && (
                          <button
                            onClick={() => setCompleteModal(a)}
                            className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-400 rounded-lg text-xs font-bold border border-emerald-200 dark:border-emerald-800"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                            Complete
                          </button>
                        )}
                        <button
                          onClick={() => openModal("audits", a, AUDIT_FIELDS)}
                          className="px-2.5 py-1.5 bg-slate-800/60 text-blue-400 rounded-lg text-xs font-bold"
                        >
                          <Pencil className="w-3.5 h-3.5 inline mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => del("audits", a)}
                          className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-400 rounded-lg text-xs font-bold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openModal("findings", null, FINDING_FIELDS)}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add Finding
            </button>
          </div>
          <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-800/60 border-b border-slate-700">
                <tr>
                  {[
                    "Audit",
                    "Clause",
                    "Description",
                    "Severity",
                    "Status",
                    "Corrective Action",
                    "Linked NCR",
                    "Due",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3.5 font-semibold text-slate-200"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 divide-slate-800">
                {allFindings.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-10 text-center text-slate-400 italic"
                    >
                      No findings recorded.
                    </td>
                  </tr>
                )}
                {allFindings.map((f) => (
                  <tr
                    key={f.id}
                    className="hover:bg-slate-800/90/20 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="font-bold text-white">
                        {f._audit?.auditNumber}
                      </div>
                      <div className="text-xs text-slate-400">
                        {f._audit?.title}
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-600 text-slate-300">
                      {f.clause}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-slate-300 max-w-[240px] truncate">
                      {f.description}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${badge(f.severity)}`}
                      >
                        {f.severity}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${badge(f.status === "IN_PROGRESS" ? "F_IN_PROGRESS" : f.status)}`}
                      >
                        {f.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 max-w-[220px] truncate">
                      {f.correctiveAction || "â€”"}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-slate-300">
                      {f.ncrId ? "Linked" : "â€”"}
                    </td>
                    <td className="px-5 py-3 text-slate-400">
                      {f.dueDate
                        ? new Date(f.dueDate).toLocaleDateString()
                        : "â€”"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        {f.status !== "CLOSED" && (
                          <button
                            onClick={() =>
                              api("findings", "update", {
                                id: f.id,
                                status: "CLOSED",
                              })
                            }
                            className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-400 rounded-lg text-xs font-bold border border-emerald-200 dark:border-emerald-800"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                            Close
                          </button>
                        )}
                        <button
                          onClick={() =>
                            openModal("findings", f, FINDING_FIELDS)
                          }
                          className="px-2.5 py-1.5 bg-slate-800/60 text-blue-400 rounded-lg text-xs font-bold"
                        >
                          <Pencil className="w-3.5 h-3.5 inline mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => del("findings", f)}
                          className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-400 rounded-lg text-xs font-bold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COMPLETE AUDIT MODAL */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">
                Complete Audit â€” {completeModal.auditNumber}
              </h3>
              <button
                onClick={() => setCompleteModal(null)}
                className="text-slate-400 hover:text-slate-600 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                api("audits", "completeAudit", {
                  id: completeModal.id,
                  result: String(fd.get("result") || ""),
                });
                setCompleteModal(null);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Audit Result
                </label>
                <select
                  name="result"
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="PASS">PASS</option>
                  <option value="PASS_WITH_FINDINGS">PASS WITH FINDINGS</option>
                  <option value="FAIL">FAIL</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCompleteModal(null)}
                  className="px-4 py-2 text-slate-400 hover:bg-slate-800/90 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Complete Audit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GENERIC MODAL */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">
                {modal.row ? "Edit" : "New"} Record
              </h3>
              <button
                onClick={() => setModal(null)}
                className="text-slate-400 hover:text-slate-600 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={save}
              className="p-6 space-y-4 max-h-[70vh] overflow-y-auto"
            >
              {(modal.entity === "audits" ? AUDIT_FIELDS : FINDING_FIELDS).map(
                (f) => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      {f.label}
                      {f.required ? " *" : ""}
                    </label>
                    <FieldInput field={f} form={form} setForm={setForm} />
                  </div>
                ),
              )}
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-4 py-2 text-slate-400 hover:bg-slate-800/90 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : modal.row ? "Save Changes" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
