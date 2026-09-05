"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Gauge,
  Factory,
  AlertTriangle,
  X,
  ArrowRightLeft,
  Upload,
  FileCheck2,
} from "lucide-react";

const TOOL_TYPES = ["GAUGE", "TORQUE_WRENCH", "CMM", "MICROMETER"];
const PROCESS_TYPES = ["HEAT_TREAT", "PLATING", "NDT", "WELDING", "ANODIZE"];
const LOCATIONS = ["LAB_CABINET", "WITH_OPERATOR", "SHOPFLOOR", "QUARANTINE"];
const LIFECYCLES = ["PROCUREMENT", "ACTIVE", "RETIRED"];

const DAY_MS = 24 * 60 * 60 * 1000;

function daysLeft(expiresAt: string | Date) {
  return Math.floor((new Date(expiresAt).getTime() - Date.now()) / DAY_MS);
}

function statusPill(status: string) {
  if (status === "OK" || status === "APPROVED") {
    return {
      label: status === "OK" ? "OK" : "APPROVED",
      cls: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
    };
  }
  if (status === "EXPIRING_SOON") {
    return {
      label: "EXPIRING SOON",
      cls: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
    };
  }
  return {
    label: "EXPIRED",
    cls: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
  };
}

function locationBadge(location: string) {
  const map: Record<string, { label: string; cls: string }> = {
    LAB_CABINET: {
      label: "Lab Cabinet",
      cls: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
    },
    WITH_OPERATOR: {
      label: "With Operator",
      cls: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
    },
    SHOPFLOOR: {
      label: "Shopfloor",
      cls: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30",
    },
    QUARANTINE: {
      label: "Quarantine Cage",
      cls: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
    },
    RETIRED: {
      label: "Retired",
      cls: "bg-purple-500/10 text-purple-400 border border-purple-500/30",
    },
  };
  return (
    map[location] || {
      label: location,
      cls: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
    }
  );
}

function LifeBar({ expiresAt }: { expiresAt: string | Date }) {
  const days = daysLeft(expiresAt);
  const pct = Math.min(100, Math.max(0, (days / 365) * 100));
  const isExpired = days <= 0;
  const isExpiring = !isExpired && days <= 30;
  const color = isExpired
    ? "bg-rose-500"
    : isExpiring
      ? "bg-amber-500"
      : "bg-emerald-500";
  const text = isExpired ? "Expired" : `${days} days left`;

  return (
    <div className="w-full max-w-[140px]">
      <div className="w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className={`text-[10px] font-mono mt-0.5 ${
          isExpired
            ? "text-rose-500"
            : isExpiring
              ? "text-amber-500"
              : "text-emerald-500"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

type ToolForm = {
  id?: string;
  toolType: string;
  name: string;
  serialNumber: string;
  calibratedAt: string;
  expiresAt: string;
  certNumber: string;
  location: string;
  lifecycle: string;
  calibrationIntervalDays: string;
};

type VendorForm = {
  id?: string;
  name: string;
  processType: string;
  nadcapCertNumber: string;
  expiresAt: string;
};

const emptyToolForm = (): ToolForm => ({
  toolType: "GAUGE",
  name: "",
  serialNumber: "",
  calibratedAt: "",
  expiresAt: "",
  certNumber: "",
  location: "LAB_CABINET",
  lifecycle: "ACTIVE",
  calibrationIntervalDays: "",
});

const emptyVendorForm = (): VendorForm => ({
  name: "",
  processType: "HEAT_TREAT",
  nadcapCertNumber: "",
  expiresAt: "",
});

export default function MetrologyTab() {
  const [subTab, setSubTab] = useState<"tools" | "vendors">("tools");
  const [loading, setLoading] = useState(true);
  const [tools, setTools] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const [toolModal, setToolModal] = useState<{ open: boolean; form: ToolForm }>(
    {
      open: false,
      form: emptyToolForm(),
    },
  );
  const [vendorModal, setVendorModal] = useState<{
    open: boolean;
    form: VendorForm;
  }>({ open: false, form: emptyVendorForm() });

  const [issueModal, setIssueModal] = useState<{
    open: boolean;
    tool: any | null;
    issuedToName: string;
    expectedReturnAt: string;
    notes: string;
  }>({
    open: false,
    tool: null,
    issuedToName: "",
    expectedReturnAt: "",
    notes: "",
  });

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/metrology");
      if (res.ok) {
        const json = await res.json();
        setTools(json.calibratedTools || []);
        setVendors(json.specialProcessVendors || []);
      }
    } catch (e) {
      logClientError(e, "MetrologyTab");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (toolModal.open) {
          setToolModal({ open: false, form: emptyToolForm() });
        }
        if (vendorModal.open) {
          setVendorModal({ open: false, form: emptyVendorForm() });
        }
        if (issueModal.open) {
          setIssueModal({
            open: false,
            tool: null,
            issuedToName: "",
            expectedReturnAt: "",
            notes: "",
          });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toolModal.open, vendorModal.open, issueModal.open]);

  const saveEntity = async (
    entity: "calibratedTools" | "specialProcessVendors",
    action: "create" | "update",
    payload: any,
  ) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, action, data: payload }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Save failed");
        return false;
      }
      await fetchData();
      return true;
    } catch (e) {
      logClientError(e, "MetrologyTab");
      alert("Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (
    entity: "calibratedTools" | "specialProcessVendors",
    id: string,
    label: string,
  ) => {
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, action: "delete", data: { id } }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Delete failed");
      } else {
        await fetchData();
      }
    } catch (e) {
      logClientError(e, "MetrologyTab");
      alert("Delete failed");
    } finally {
      setSaving(false);
    }
  };

  const submitTool = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = toolModal.form;
    const payload = {
      ...(f.id ? { id: f.id } : {}),
      toolType: f.toolType,
      name: f.name.trim(),
      serialNumber: f.serialNumber.trim(),
      calibratedAt: new Date(f.calibratedAt).toISOString(),
      expiresAt: new Date(f.expiresAt).toISOString(),
      certNumber: f.certNumber.trim() || null,
      location: f.location,
      lifecycle: f.lifecycle,
      calibrationIntervalDays: f.calibrationIntervalDays
        ? parseInt(f.calibrationIntervalDays, 10)
        : null,
    };
    const ok = await saveEntity(
      "calibratedTools",
      f.id ? "update" : "create",
      payload,
    );
    if (ok) setToolModal({ open: false, form: emptyToolForm() });
  };

  const submitVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = vendorModal.form;
    const payload = {
      ...(f.id ? { id: f.id } : {}),
      name: f.name.trim(),
      processType: f.processType,
      nadcapCertNumber: f.nadcapCertNumber.trim() || null,
      expiresAt: new Date(f.expiresAt).toISOString(),
    };
    const ok = await saveEntity(
      "specialProcessVendors",
      f.id ? "update" : "create",
      payload,
    );
    if (ok) setVendorModal({ open: false, form: emptyVendorForm() });
  };

  const submitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueModal.tool) return;
    setSaving(true);
    try {
      const res = await fetch("/api/metrology/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calibratedToolId: issueModal.tool.id,
          issuedToName: issueModal.issuedToName.trim(),
          expectedReturnAt: new Date(issueModal.expectedReturnAt).toISOString(),
          notes: issueModal.notes.trim() || null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(d.error || "Issue failed");
      } else {
        setIssueModal({
          open: false,
          tool: null,
          issuedToName: "",
          expectedReturnAt: "",
          notes: "",
        });
        await fetchData();
      }
    } catch (err) {
      logClientError(err, "MetrologyTab");
      alert("Issue failed");
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async (issueId: string) => {
    if (!confirm("Confirm return of this instrument to the tool crib?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/metrology/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(d.error || "Return failed");
      } else {
        await fetchData();
      }
    } catch (err) {
      logClientError(err, "MetrologyTab");
      alert("Return failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCertUpload = async (toolId: string, file: File | null) => {
    if (!file) return;
    setUploadingId(toolId);
    try {
      const fd = new FormData();
      fd.append("toolId", toolId);
      fd.append("file", file);
      const res = await fetch("/api/metrology/cert", {
        method: "POST",
        body: fd,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(d.error || "Upload failed");
      } else {
        await fetchData();
      }
    } catch (err) {
      logClientError(err, "MetrologyTab");
      alert("Upload failed");
    } finally {
      setUploadingId(null);
    }
  };

  const openToolEdit = (t: any) => {
    setToolModal({
      open: true,
      form: {
        id: t.id,
        toolType: t.toolType,
        name: t.name,
        serialNumber: t.serialNumber,
        calibratedAt: new Date(t.calibratedAt).toISOString().slice(0, 10),
        expiresAt: new Date(t.expiresAt).toISOString().slice(0, 10),
        certNumber: t.certNumber || "",
        location: t.location || "LAB_CABINET",
        lifecycle: t.lifecycle || "ACTIVE",
        calibrationIntervalDays: t.calibrationIntervalDays
          ? String(t.calibrationIntervalDays)
          : "",
      },
    });
  };

  const openVendorEdit = (v: any) => {
    setVendorModal({
      open: true,
      form: {
        id: v.id,
        name: v.name,
        processType: v.processType,
        nadcapCertNumber: v.nadcapCertNumber || "",
        expiresAt: new Date(v.expiresAt).toISOString().slice(0, 10),
      },
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            Metrology & Tool Crib (Nadcap)
          </h2>
          <p className="text-slate-400 text-sm">
            Calibrated tooling, issue/return custody, quarantine cage, and
            approved special-process suppliers.
          </p>
        </div>
        <button
          onClick={() =>
            subTab === "tools"
              ? setToolModal({ open: true, form: emptyToolForm() })
              : setVendorModal({ open: true, form: emptyVendorForm() })
          }
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add{" "}
          {subTab === "tools" ? "Calibrated Tool" : "Special Process Vendor"}
        </button>
      </div>

      {/* SUB-TABS */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab("tools")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            subTab === "tools"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-800/60 text-slate-600 text-slate-300 hover:bg-slate-200 hover:bg-slate-700 border border-slate-600"
          }`}
        >
          <Gauge className="w-4 h-4" />
          Calibrated Tools
          <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/10 dark:bg-black/30">
            {tools.length}
          </span>
        </button>
        <button
          onClick={() => setSubTab("vendors")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            subTab === "vendors"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-800/60 text-slate-600 text-slate-300 hover:bg-slate-200 hover:bg-slate-700 border border-slate-600"
          }`}
        >
          <Factory className="w-4 h-4" />
          Special Process Vendors
          <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-black/10 dark:bg-black/30">
            {vendors.length}
          </span>
        </button>
      </div>

      {/* TOOLS TABLE */}
      {subTab === "tools" && (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/60 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-200">Tool</th>
                <th className="px-6 py-4 font-semibold text-slate-200">
                  Serial
                </th>
                <th className="px-6 py-4 font-semibold text-slate-200">
                  Cert No.
                </th>
                <th className="px-6 py-4 font-semibold text-slate-200">
                  Calibrated
                </th>
                <th className="px-6 py-4 font-semibold text-slate-200">
                  Expires
                </th>
                <th className="px-6 py-4 font-semibold text-slate-200">
                  Next Due
                </th>
                <th className="px-6 py-4 font-semibold text-slate-200">Life</th>
                <th className="px-6 py-4 font-semibold text-slate-200">
                  Location / Custodian
                </th>
                <th className="px-6 py-4 font-semibold text-slate-200">
                  Status
                </th>
                <th className="px-6 py-4 font-semibold text-slate-200 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {tools.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-8 text-center text-slate-400 italic"
                  >
                    No calibrated tools registered.
                  </td>
                </tr>
              )}
              {tools.map((t) => {
                const pill = statusPill(t.status);
                const locBadge = locationBadge(t.location);
                const isQuarantined = t.location === "QUARANTINE";
                const isRetired = t.location === "RETIRED";
                const canIssue = !isQuarantined && !isRetired && !t.openIssue;
                return (
                  <tr
                    key={t.id}
                    className={`transition-colors ${
                      isQuarantined
                        ? "bg-rose-50/60 dark:bg-rose-950/20"
                        : "hover:bg-slate-800/90/20"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{t.name}</div>
                      <div className="text-[10px] font-black text-slate-500 mt-0.5">
                        {t.toolType}
                        {t.lifecycle === "RETIRED" && " · RETIRED"}
                        {t.lifecycle === "PROCUREMENT" && " · PROCUREMENT"}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-600 text-slate-300">
                      {t.serialNumber}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-slate-400">
                        {t.certNumber || "—"}
                      </div>
                      <a
                        href={`/api/metrology/cert?toolId=${t.id}`}
                        target="_blank"
                        className="text-[10px] font-bold text-teal-400 hover:underline inline-flex items-center gap-0.5"
                      >
                        <FileCheck2 className="w-3 h-3" />
                        {t.certFileSizeKb
                          ? `Cert ${t.certFileSizeKb} KB`
                          : "No cert"}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-slate-300">
                      {new Date(t.calibratedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-slate-300">
                      {new Date(t.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-slate-300">
                      {t.nextDue
                        ? new Date(t.nextDue).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <LifeBar expiresAt={t.expiresAt} />
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${locBadge.cls}`}
                      >
                        {locBadge.label}
                      </span>
                      {t.openIssue && (
                        <div className="text-[10px] font-mono text-slate-400 mt-1">
                          {t.openIssue.issuedToName} · since{" "}
                          {new Date(t.openIssue.issuedAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${pill.cls}`}
                      >
                        {pill.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => openToolEdit(t)}
                          title="Edit"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-200 hover:bg-slate-700 text-blue-400 rounded-lg border border-slate-600 text-xs font-bold transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {t.openIssue ? (
                          <button
                            onClick={() => handleReturn(t.openIssue.id)}
                            disabled={saving}
                            title="Return to crib"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 hover:bg-emerald-900/40 text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition-colors disabled:opacity-50"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" /> Return
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              setIssueModal({
                                open: true,
                                tool: t,
                                issuedToName: "",
                                expectedReturnAt: new Date(
                                  Date.now() + 3 * 86400000,
                                )
                                  .toISOString()
                                  .slice(0, 10),
                                notes: "",
                              })
                            }
                            disabled={!canIssue}
                            title={
                              isQuarantined
                                ? "In quarantine cage — cannot be issued"
                                : isRetired
                                  ? "Retired — cannot be issued"
                                  : "Issue to operator"
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 hover:bg-blue-900/40 text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" /> Issue
                          </button>
                        )}
                        <label
                          title="Upload calibration certificate"
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                            uploadingId === t.id
                              ? "bg-teal-50 dark:bg-teal-950/40 text-teal-400 border-teal-200 dark:border-teal-800"
                              : "bg-slate-800/60 hover:bg-slate-200 hover:bg-slate-700 text-slate-600 text-slate-300 border border-slate-600"
                          }`}
                        >
                          {uploadingId === t.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            className="hidden"
                            onChange={(e) =>
                              handleCertUpload(
                                t.id,
                                e.target.files?.[0] || null,
                              )
                            }
                          />
                        </label>
                        <button
                          onClick={() =>
                            handleDelete("calibratedTools", t.id, t.name)
                          }
                          title="Delete"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 hover:bg-rose-900/40 text-rose-400 rounded-lg border border-rose-200 dark:border-rose-800 text-xs font-bold transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* VENDORS TABLE */}
      {subTab === "vendors" && (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/60 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-200">
                  Vendor
                </th>
                <th className="px-6 py-4 font-semibold text-slate-200">
                  Process
                </th>
                <th className="px-6 py-4 font-semibold text-slate-200">
                  Nadcap Cert
                </th>
                <th className="px-6 py-4 font-semibold text-slate-200">
                  Cert Expires
                </th>
                <th className="px-6 py-4 font-semibold text-slate-200">Life</th>
                <th className="px-6 py-4 font-semibold text-slate-200">
                  Status
                </th>
                <th className="px-6 py-4 font-semibold text-slate-200 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {vendors.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-slate-400 italic"
                  >
                    No special process vendors registered.
                  </td>
                </tr>
              )}
              {vendors.map((v) => {
                const pill = statusPill(v.status);
                return (
                  <tr
                    key={v.id}
                    className="hover:bg-slate-800/90/20 transition-colors"
                  >
                    <td className="px-6 py-4 font-bold text-white">{v.name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 text-[10px] font-black rounded bg-slate-800/60 border border-slate-600 text-slate-600 text-slate-300">
                        {v.processType}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-600 text-slate-300">
                      {v.nadcapCertNumber || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-slate-300">
                      {new Date(v.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <LifeBar expiresAt={v.expiresAt} />
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${pill.cls}`}
                      >
                        {pill.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openVendorEdit(v)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-200 hover:bg-slate-700 text-blue-400 rounded-lg border border-slate-600 text-xs font-bold transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() =>
                            handleDelete("specialProcessVendors", v.id, v.name)
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 hover:bg-rose-900/40 text-rose-400 rounded-lg border border-rose-200 dark:border-rose-800 text-xs font-bold transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TOOL MODAL ── */}
      {toolModal.open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tool-modal-title"
          onClick={() =>
            setToolModal({ open: false, form: emptyToolForm() })
          }
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
          >
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 id="tool-modal-title" className="text-lg font-bold text-white">
                {toolModal.form.id
                  ? "Edit Calibrated Tool"
                  : "Register Calibrated Tool"}
              </h3>
              <button
                type="button"
                onClick={() =>
                  setToolModal({ open: false, form: emptyToolForm() })
                }
                aria-label="Close tool dialog"
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitTool} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Tool Type
                  </label>
                  <select
                    required
                    value={toolModal.form.toolType}
                    onChange={(e) =>
                      setToolModal({
                        ...toolModal,
                        form: { ...toolModal.form, toolType: e.target.value },
                      })
                    }
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  >
                    {TOOL_TYPES.map((tt) => (
                      <option key={tt} value={tt}>
                        {tt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Lifecycle
                  </label>
                  <select
                    value={toolModal.form.lifecycle}
                    onChange={(e) =>
                      setToolModal({
                        ...toolModal,
                        form: { ...toolModal.form, lifecycle: e.target.value },
                      })
                    }
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  >
                    {LIFECYCLES.map((lc) => (
                      <option key={lc} value={lc}>
                        {lc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Tool Name
                  </label>
                  <input
                    required
                    value={toolModal.form.name}
                    onChange={(e) =>
                      setToolModal({
                        ...toolModal,
                        form: { ...toolModal.form, name: e.target.value },
                      })
                    }
                    placeholder="e.g. Digital Micrometer 0-25mm"
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Serial Number
                  </label>
                  <input
                    required
                    value={toolModal.form.serialNumber}
                    onChange={(e) =>
                      setToolModal({
                        ...toolModal,
                        form: {
                          ...toolModal.form,
                          serialNumber: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. CAL-MIC-001"
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Calibrated Date
                  </label>
                  <input
                    required
                    type="date"
                    value={toolModal.form.calibratedAt}
                    onChange={(e) =>
                      setToolModal({
                        ...toolModal,
                        form: {
                          ...toolModal.form,
                          calibratedAt: e.target.value,
                        },
                      })
                    }
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Expiry Date
                  </label>
                  <input
                    required
                    type="date"
                    value={toolModal.form.expiresAt}
                    onChange={(e) =>
                      setToolModal({
                        ...toolModal,
                        form: { ...toolModal.form, expiresAt: e.target.value },
                      })
                    }
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Cert Number
                  </label>
                  <input
                    value={toolModal.form.certNumber}
                    onChange={(e) =>
                      setToolModal({
                        ...toolModal,
                        form: { ...toolModal.form, certNumber: e.target.value },
                      })
                    }
                    placeholder="e.g. NPL-CAL-2210-01"
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Calibration Interval (days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={toolModal.form.calibrationIntervalDays}
                    onChange={(e) =>
                      setToolModal({
                        ...toolModal,
                        form: {
                          ...toolModal.form,
                          calibrationIntervalDays: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. 365"
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Location
                </label>
                <select
                  value={toolModal.form.location}
                  onChange={(e) =>
                    setToolModal({
                      ...toolModal,
                      form: { ...toolModal.form, location: e.target.value },
                    })
                  }
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  EXPIRED instruments are automatically quarantined regardless
                  of this value.
                </p>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setToolModal({ open: false, form: emptyToolForm() })
                  }
                  className="px-4 py-2 text-slate-400 hover:bg-slate-800/90 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : toolModal.form.id
                      ? "Save Changes"
                      : "Register Tool"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VENDOR MODAL ── */}
      {vendorModal.open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="vendor-modal-title"
          onClick={() =>
            setVendorModal({ open: false, form: emptyVendorForm() })
          }
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 id="vendor-modal-title" className="text-lg font-bold text-white">
                {vendorModal.form.id
                  ? "Edit Special Process Vendor"
                  : "Add Special Process Vendor"}
              </h3>
              <button
                type="button"
                onClick={() =>
                  setVendorModal({ open: false, form: emptyVendorForm() })
                }
                aria-label="Close vendor dialog"
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitVendor} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Vendor Name
                </label>
                <input
                  required
                  value={vendorModal.form.name}
                  onChange={(e) =>
                    setVendorModal({
                      ...vendorModal,
                      form: { ...vendorModal.form, name: e.target.value },
                    })
                  }
                  placeholder="e.g. AeroHeat Treat Ltd"
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Process Type
                </label>
                <select
                  required
                  value={vendorModal.form.processType}
                  onChange={(e) =>
                    setVendorModal({
                      ...vendorModal,
                      form: {
                        ...vendorModal.form,
                        processType: e.target.value,
                      },
                    })
                  }
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                >
                  {PROCESS_TYPES.map((pt) => (
                    <option key={pt} value={pt}>
                      {pt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Nadcap Cert Number
                </label>
                <input
                  value={vendorModal.form.nadcapCertNumber}
                  onChange={(e) =>
                    setVendorModal({
                      ...vendorModal,
                      form: {
                        ...vendorModal.form,
                        nadcapCertNumber: e.target.value,
                      },
                    })
                  }
                  placeholder="e.g. Nadcap-AC-4412"
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Cert Expiry Date
                </label>
                <input
                  required
                  type="date"
                  value={vendorModal.form.expiresAt}
                  onChange={(e) =>
                    setVendorModal({
                      ...vendorModal,
                      form: { ...vendorModal.form, expiresAt: e.target.value },
                    })
                  }
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>
              {new Date(vendorModal.form.expiresAt + "T00:00:00") <
                new Date() && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  This cert is already expired — the vendor will be marked
                  EXPIRED and dispatch will be blocked.
                </div>
              )}
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setVendorModal({ open: false, form: emptyVendorForm() })
                  }
                  className="px-4 py-2 text-slate-400 hover:bg-slate-800/90 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : vendorModal.form.id
                      ? "Save Changes"
                      : "Add Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ISSUE MODAL ── */}
      {issueModal.open && issueModal.tool && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="issue-modal-title"
          onClick={() =>
            setIssueModal({
              open: false,
              tool: null,
              issuedToName: "",
              expectedReturnAt: "",
              notes: "",
            })
          }
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 id="issue-modal-title" className="text-lg font-bold text-white">Issue Instrument</h3>
              <button
                type="button"
                onClick={() =>
                  setIssueModal({
                    open: false,
                    tool: null,
                    issuedToName: "",
                    expectedReturnAt: "",
                    notes: "",
                  })
                }
                aria-label="Close issue dialog"
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitIssue} className="p-6 space-y-4">
              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-600">
                <div className="font-bold text-white text-sm">
                  {issueModal.tool.name}
                </div>
                <div className="text-xs font-mono text-slate-400 mt-0.5">
                  {issueModal.tool.serialNumber} · {issueModal.tool.toolType}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Issued To (Custodian)
                </label>
                <input
                  required
                  value={issueModal.issuedToName}
                  onChange={(e) =>
                    setIssueModal({
                      ...issueModal,
                      issuedToName: e.target.value,
                    })
                  }
                  placeholder="e.g. Rajesh Kumar"
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Expected Return Date
                </label>
                <input
                  required
                  type="date"
                  value={issueModal.expectedReturnAt}
                  onChange={(e) =>
                    setIssueModal({
                      ...issueModal,
                      expectedReturnAt: e.target.value,
                    })
                  }
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  value={issueModal.notes}
                  onChange={(e) =>
                    setIssueModal({ ...issueModal, notes: e.target.value })
                  }
                  placeholder="e.g. For CMM bay inspection shift B"
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setIssueModal({
                      open: false,
                      tool: null,
                      issuedToName: "",
                      expectedReturnAt: "",
                      notes: "",
                    })
                  }
                  className="px-4 py-2 text-slate-400 hover:bg-slate-800/90 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? "Issuing..." : "Confirm Issue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
