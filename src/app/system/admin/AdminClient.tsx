"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Loader2,
  KeyRound,
  UserCheck,
  ChevronDown,
  ChevronUp,
  X,
  Award,
  Zap,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";
import AdminModal from "./AdminModal";
import AssignModal from "./AssignModal";
import AuditTab from "./AuditTab";
import BrandingTab from "./BrandingTab";
import TargetsTab from "./TargetsTab";
import RoutinesTab from "./RoutinesTab";
import FiveSChecklistTab from "./FiveSChecklistTab";
import InventoryTab from "./InventoryTab";
import PurchasingTab from "./PurchasingTab";
import BomTab from "./BomTab";
import DocumentsTab from "./DocumentsTab";
import SystemConstantsTab from "./SystemConstantsTab";
import EnergyTab from "./EnergyTab";
import CertificationsTab from "./CertificationsTab";
import MetrologyTab from "./MetrologyTab";

const TABS = [
  { id: "purchasing", label: "Purchasing" },
  { id: "inventory", label: "Inventory" },
  { id: "bom", label: "BOM" },
  { id: "documents", label: "Documents & SOPs" },
  { id: "energy", label: "Energy" },
  { id: "constants", label: "System Constants" },
  { id: "certifications", label: "Certifications" },
  { id: "metrology", label: "Metrology & Vendors" },
  { id: "plants", label: "Plants" },
  { id: "machines", label: "Machines" },
  { id: "users", label: "Users" },
  { id: "products", label: "Products" },
  { id: "lines", label: "Lines" },
  { id: "shifts", label: "Shifts" },
  { id: "downtimeReasons", label: "Downtime Reasons" },
  { id: "defectCodes", label: "Defect Codes" },
  { id: "operations", label: "Operations" },
  { id: "routingSteps", label: "Routings" },
  { id: "routines", label: "Routines" },
  { id: "fivesChecklist", label: "5S Checklist" },
  { id: "workOrders", label: "Work Orders" },
  { id: "attendanceDevices", label: "Attendance Devices" },
  { id: "audit", label: "Audit" },
  { id: "branding", label: "Branding" },
  { id: "targets", label: "Targets" },
];

export default function AdminClient() {
  const [activeTab, setActiveTab] = useState("purchasing");
  const [prefillMaterialId, setPrefillMaterialId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      const matParam = params.get("materialId");
      if (tabParam) {
        setActiveTab(tabParam);
      }
      if (matParam) {
        setPrefillMaterialId(matParam);
      }
    }
  }, []);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [assigningMachine, setAssigningMachine] = useState<any | null>(null);
  const [expandedOperators, setExpandedOperators] = useState<
    Record<string, boolean>
  >({});
  const [revealedPasswords, setRevealedPasswords] = useState<
    Record<string, string>
  >({});
  const [revealingLoading, setRevealingLoading] = useState<
    Record<string, boolean>
  >({});
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

  const handleToggleRevealPassword = async (userId: string) => {
    if (revealedPasswords[userId]) {
      setRevealedPasswords((prev) => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
      return;
    }

    try {
      setRevealingLoading((prev) => ({ ...prev, [userId]: true }));
      const res = await fetch(`/api/admin/reveal-password?userId=${userId}`);
      const resData = await res.json();
      if (res.ok) {
        setRevealedPasswords((prev) => ({
          ...prev,
          [userId]: resData.lastSetPassword || "Not set",
        }));
      } else {
        alert(resData.error || "Failed to reveal password");
      }
    } catch (err) {
      console.error("Reveal password error:", err);
    } finally {
      setRevealingLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const formatPasswordChangedAt = (dateStr?: string | Date | null) => {
    if (!dateStr) return "not changed yet";
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return "changed just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `changed ${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `changed ${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `changed ${diffDay}d ago`;
  };

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    entity: string;
    initialData: any | null;
  }>({
    isOpen: false,
    entity: "machines",
    initialData: null,
  });

  const [resetPasswordState, setResetPasswordState] = useState<{
    isOpen: boolean;
    user: any | null;
    newPassword: string;
    mustChange: boolean;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    user: null,
    newPassword: "",
    mustChange: true,
    loading: false,
    error: null,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/data");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        console.error("Failed to fetch admin data");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (item: any) => {
    setModalState({
      isOpen: true,
      entity: activeTab,
      initialData: item,
    });
  };

  const handleAdd = () => {
    setModalState({
      isOpen: true,
      entity: activeTab,
      initialData: null,
    });
  };

  const handleSaved = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    fetchData();
  };

  const handleUnassign = async (assignmentId: string) => {
    try {
      const res = await fetch(`/api/assignments?id=${assignmentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchData();
      } else {
        alert("Failed to unassign operator");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetPasswordState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "users",
          action: "update",
          data: {
            id: resetPasswordState.user.id,
            password: resetPasswordState.newPassword,
            mustChangePassword: resetPasswordState.mustChange,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to reset password");
      setResetPasswordState((prev) => ({
        ...prev,
        isOpen: false,
        loading: false,
      }));
      fetchData();
    } catch (err: any) {
      setResetPasswordState((prev) => ({
        ...prev,
        loading: false,
        error: err.message,
      }));
    }
  };

  const toggleOperatorExpand = (opId: string) => {
    setExpandedOperators((prev) => ({ ...prev, [opId]: !prev[opId] }));
  };

  // Custom Renderer for Attendance Devices Tab
  const renderAttendanceDevicesTable = () => {
    const devices = data.attendanceDevices || [];

    const rows = devices.map((d: any) => (
      <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
        <td className="px-6 py-4">
          <div className="font-bold text-white">{d.name}</div>
          <div className="text-xs text-slate-400">{d.type}</div>
        </td>
        <td className="px-6 py-4">
          <span className="px-2.5 py-1 bg-slate-800/60 rounded border border-slate-700 text-xs font-mono text-slate-300">
            {d.type}
          </span>
        </td>
        <td className="px-6 py-4">
          <code className="bg-slate-900/50 px-2 py-1 rounded text-xs font-mono text-slate-300">
            {d.endpointKey}
          </code>
        </td>
        <td className="px-6 py-4">
          {d.isActive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
              Inactive
            </span>
          )}
        </td>
        <td className="px-6 py-4 text-slate-400">
          {d.lastSeen ? (
            new Date(d.lastSeen).toLocaleString()
          ) : (
            <span className="italic text-slate-500">Never</span>
          )}
        </td>
        <td className="px-6 py-4 text-right flex justify-end gap-2">
          <button
            onClick={() => handleEdit(d)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 rounded-lg transition-colors border border-slate-700"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </button>
        </td>
      </tr>
    ));

    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/50 text-slate-300 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Device</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Endpoint Key</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Last Seen</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">{rows}</tbody>
          </table>
        </div>
      </div>
    );
  };
  const renderMachinesTable = () => {
    const machines = data.machines || [];
    const inProgressWOs = (data.workOrders || []).filter(
      (wo: any) => wo.status === "IN_PROGRESS",
    );

    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/50 text-slate-300 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Machine</th>
                <th className="px-6 py-4">Station</th>
                <th className="px-6 py-4">Line</th>
                <th className="px-6 py-4">Running Work Order</th>
                <th className="px-6 py-4">Assigned Operators (by Shift)</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {machines.map((m: any) => {
                const runningWO =
                  m.status === "RUNNING"
                    ? inProgressWOs.find((wo: any) =>
                        wo.productionLogs?.some(
                          (log: any) => log.machineId === m.id,
                        ),
                      ) || inProgressWOs[0]
                    : null;

                const activeAssignments = m.assignments || [];

                return (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{m.name}</div>
                      <div className="text-xs font-mono text-slate-400">
                        {m.code}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {m.stationName ? (
                        <span className="px-2.5 py-1 bg-slate-800 rounded border border-slate-700 text-xs font-mono">
                          📍 {m.stationName}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {m.line?.name || "—"}
                    </td>
                    <td className="px-6 py-4">
                      {runningWO ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Zap className="w-3 h-3 animate-pulse" />{" "}
                            {runningWO.woNumber}
                          </span>
                          <span className="text-xs text-slate-300 font-semibold">
                            {runningWO.product?.name}
                          </span>
                        </div>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-800/60 rounded text-slate-400 text-xs">
                          Idle
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2 items-center">
                        {activeAssignments.length === 0 ? (
                          <span className="text-xs text-slate-500 italic">
                            No operators assigned
                          </span>
                        ) : (
                          activeAssignments.map((a: any) => {
                            const shiftShort =
                              a.shift?.name?.replace("Shift ", "") || "Shift";
                            return (
                              <span
                                key={a.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-950/60 text-blue-300 border border-blue-800/80 rounded-xl text-xs font-medium"
                              >
                                <span className="font-bold text-blue-400 font-mono">
                                  {shiftShort}:
                                </span>
                                <span>{a.operator?.name}</span>
                                <button
                                  onClick={() => handleUnassign(a.id)}
                                  className="text-blue-400 hover:text-rose-400 transition-colors ml-0.5"
                                  title="Unassign"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button
                        onClick={() => setAssigningMachine(m)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors border border-blue-500/30 text-xs font-bold"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Assign
                      </button>
                      <button
                        onClick={() => handleEdit(m)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 rounded-lg transition-colors border border-slate-700 text-xs font-bold"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Custom Renderer for Users / Operators Tab with Skill Matrix
  const renderUsersTable = () => {
    const users = data.users || [];
    const operatorStats = data.operatorStats || {};

    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl space-y-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/50 text-slate-300 font-semibold border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Password</th>
                <th className="px-6 py-4">Current Assignments</th>
                <th className="px-6 py-4">Best Machine Fit</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {users.map((u: any) => {
                const statsInfo = operatorStats[u.id] || {
                  machineStats: [],
                  bestFit: null,
                };
                const isExpanded = Boolean(expandedOperators[u.id]);
                const activeAssignments = u.assignments || [];

                return (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    <td colSpan={6} className="p-0">
                      <div className="flex items-center justify-between px-6 py-4">
                        <div className="w-1/5">
                          <div className="font-bold text-white flex items-center gap-2">
                            {u.name}
                            {u.role?.name === "Operator" &&
                              statsInfo.machineStats.length > 0 && (
                                <button
                                  onClick={() => toggleOperatorExpand(u.id)}
                                  className="p-1 text-slate-400 hover:text-cyan-400 rounded transition-colors"
                                  title="Toggle Skill Matrix"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-cyan-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                            {u.employeeNumber && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30 font-mono">
                                EMP {u.employeeNumber}
                              </span>
                            )}
                            {u.level && (
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                                  u.level === "MANAGER"
                                    ? "bg-purple-500/10 text-purple-300 border border-purple-500/30"
                                    : "bg-slate-500/10 text-slate-400 border border-slate-500/30"
                                }`}
                              >
                                {u.level}
                              </span>
                            )}
                            <span>{u.email || u.username}</span>
                            {u.email &&
                              u.email.includes("@") &&
                              u.email.includes(".") && (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                  title="This user has a registered email eligible for Google OAuth login"
                                >
                                  Google-ready
                                </span>
                              )}
                          </div>
                        </div>

                        <div className="w-1/6">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              u.isOwner
                                ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                : u.role &&
                                    u.role.permissions &&
                                    u.role.permissions.includes("ops.edit")
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {u.role}
                          </span>
                        </div>

                        <div className="w-1/5">
                          {u.id === data?.currentUserId ? (
                            <div>
                              <div className="font-mono text-sm text-slate-400">
                                ••••••••
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {formatPasswordChangedAt(u.passwordChangedAt)}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-slate-200">
                                  {revealedPasswords[u.id]
                                    ? revealedPasswords[u.id]
                                    : "••••••••"}
                                </span>

                                <button
                                  onClick={() =>
                                    handleToggleRevealPassword(u.id)
                                  }
                                  disabled={revealingLoading[u.id]}
                                  className="p-1 text-slate-400 hover:text-cyan-400 rounded transition-colors cursor-pointer"
                                  title={
                                    revealedPasswords[u.id]
                                      ? "Hide password"
                                      : "Reveal password (logs audit)"
                                  }
                                >
                                  {revealingLoading[u.id] ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                                  ) : revealedPasswords[u.id] ? (
                                    <EyeOff className="w-4 h-4 text-cyan-400" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </button>

                                {revealedPasswords[u.id] && (
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        revealedPasswords[u.id],
                                      );
                                      setCopiedUserId(u.id);
                                      setTimeout(
                                        () => setCopiedUserId(null),
                                        2000,
                                      );
                                    }}
                                    className="p-1 text-slate-400 hover:text-emerald-400 rounded transition-colors cursor-pointer"
                                    title="Copy password to clipboard"
                                  >
                                    {copiedUserId === u.id ? (
                                      <Check className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                              </div>

                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {formatPasswordChangedAt(u.passwordChangedAt)}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="w-1/4">
                          <div className="flex flex-wrap gap-1.5">
                            {activeAssignments.length === 0 ? (
                              <span className="text-xs text-slate-500 italic">
                                No active assignment
                              </span>
                            ) : (
                              activeAssignments.map((a: any) => (
                                <span
                                  key={a.id}
                                  className="px-2.5 py-0.5 bg-blue-950/60 text-blue-300 border border-blue-800/80 rounded-lg text-xs font-mono"
                                >
                                  {a.machine?.code || a.machine?.name} (
                                  {a.shift?.name})
                                </span>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="w-1/4">
                          {statsInfo.bestFit ? (
                            <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                              <Award className="w-4 h-4 text-emerald-400" />
                              Best fit: {statsInfo.bestFit.machineName} (
                              {statsInfo.bestFit.efficiencyPct}%)
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </div>

                        <div className="text-right flex justify-end gap-2 w-1/6">
                          <button
                            onClick={() =>
                              setResetPasswordState({
                                isOpen: true,
                                user: u,
                                newPassword: "",
                                mustChange: true,
                                loading: false,
                                error: null,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded-lg transition-colors border border-slate-700 text-xs font-bold"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            Reset Pwd
                          </button>
                          <button
                            onClick={() => handleEdit(u)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 rounded-lg transition-colors border border-slate-700 text-xs font-bold"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        </div>
                      </div>

                      {/* Expandable Skill Matrix for Operator */}
                      {isExpanded && statsInfo.machineStats.length > 0 && (
                        <div className="px-8 py-4 bg-slate-950/60 border-t border-slate-800/80 space-y-3">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                            <span>Operator Machine Skill Matrix</span>
                            <span>
                              {statsInfo.machineStats.length} Machine(s)
                              Evaluated
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {statsInfo.machineStats.map((ms: any) => (
                              <div
                                key={ms.machineId}
                                className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-white text-sm">
                                    {ms.machineName}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-bold border ${ms.ratingColor}`}
                                  >
                                    {ms.rating}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                  <div>
                                    <span className="text-slate-500 block">
                                      Hours Logged
                                    </span>
                                    <span className="text-slate-200 font-bold">
                                      {ms.hoursLogged}h
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block">
                                      Good Output
                                    </span>
                                    <span className="text-emerald-400 font-bold">
                                      {ms.goodUnits.toLocaleString()} pcs
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block">
                                      Scrap Rate
                                    </span>
                                    <span className="text-rose-400 font-bold">
                                      {ms.scrapPct}%
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block">
                                      Efficiency
                                    </span>
                                    <span className="text-cyan-400 font-bold">
                                      {ms.efficiencyPct}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (activeTab === "purchasing") {
      return (
        <PurchasingTab
          prefillMaterialId={prefillMaterialId}
          onClearPrefill={() => setPrefillMaterialId(null)}
        />
      );
    }

    if (activeTab === "audit") {
      return <AuditTab />;
    }

    if (activeTab === "energy") {
      return (
        <EnergyTab
          energyData={data?.energyReadings || []}
          defaultCost={data?.settings?.defaultEnergyCostPerKwh || 8.0}
        />
      );
    }

    if (loading || !data) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      );
    }

    if (activeTab === "machines") {
      return renderMachinesTable();
    }

    if (activeTab === "attendanceDevices") {
      return renderAttendanceDevicesTable();
    }

    if (activeTab === "users") {
      return renderUsersTable();
    }

    const items = data[activeTab] || [];

    if (items.length === 0) {
      return (
        <div className="text-center p-12 bg-slate-900 rounded-xl border border-slate-800">
          <p className="text-slate-400">No records found.</p>
        </div>
      );
    }

    // Determine columns dynamically for generic tables
    const excludeCols = [
      "id",
      "createdAt",
      "updatedAt",
      "password",
      "passwordHash",
    ];
    const cols = Object.keys(items[0]).filter((k) => !excludeCols.includes(k));

    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/50 text-slate-300 font-semibold border-b border-slate-800">
              <tr>
                {cols.map((col) => (
                  <th key={col} className="px-6 py-4 capitalize">
                    {col.replace(/([A-Z])/g, " $1").trim()}
                  </th>
                ))}
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {items.map((item: any) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-800/30 transition-colors"
                >
                  {cols.map((col) => (
                    <td key={col} className="px-6 py-4 text-slate-300">
                      {col === "isActive" ? (
                        item[col] ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3.5 h-3.5" /> Inactive
                          </span>
                        )
                      ) : typeof item[col] === "object" &&
                        item[col] !== null ? (
                        item[col].name ||
                        item[col].code ||
                        item[col].sku ||
                        "Object"
                      ) : (
                        String(item[col])
                      )}
                    </td>
                  ))}
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 rounded-lg transition-colors border border-slate-700"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tabs & Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== "audit" &&
          activeTab !== "branding" &&
          activeTab !== "targets" &&
          activeTab !== "routines" &&
          activeTab !== "fivesChecklist" &&
          activeTab !== "inventory" &&
          activeTab !== "bom" &&
          activeTab !== "constants" &&
          activeTab !== "metrology" && (
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg shadow-md shadow-emerald-500/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add {TABS.find((t) => t.id === activeTab)?.label}
            </button>
          )}
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === "certifications" && <CertificationsTab />}
        {activeTab === "metrology" && <MetrologyTab />}
        {activeTab === "inventory" && <InventoryTab />}
        {activeTab === "bom" && <BomTab />}
        {activeTab === "documents" && <DocumentsTab />}
        {activeTab === "constants" && <SystemConstantsTab />}
        {activeTab === "audit" && <AuditTab />}
        {activeTab === "branding" && <BrandingTab />}
        {activeTab === "targets" && <TargetsTab />}
        {activeTab === "routines" && <RoutinesTab />}
        {activeTab === "fivesChecklist" && <FiveSChecklistTab />}

        {activeTab !== "audit" &&
          activeTab !== "branding" &&
          activeTab !== "targets" &&
          activeTab !== "routines" &&
          activeTab !== "fivesChecklist" &&
          activeTab !== "inventory" &&
          activeTab !== "bom" &&
          activeTab !== "documents" &&
          activeTab !== "constants" &&
          activeTab !== "metrology" &&
          renderTable()}
      </div>

      {/* Admin Edit/Create Modal */}
      {modalState.isOpen && (
        <AdminModal
          entity={modalState.entity}
          initialData={modalState.initialData}
          metadata={data}
          onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
          onSaved={handleSaved}
        />
      )}

      {/* Assign Operator Modal */}
      {assigningMachine && data && (
        <AssignModal
          machine={assigningMachine}
          operators={(data.users || []).filter(
            (u: any) => u.role?.name === "Operator",
          )}
          shifts={data.shifts || []}
          onClose={() => setAssigningMachine(null)}
          onSaved={() => {
            setAssigningMachine(null);
            fetchData();
          }}
        />
      )}

      {/* Reset Password Modal */}
      {resetPasswordState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              Reset Password
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              For user:{" "}
              <span className="font-semibold text-white">
                {resetPasswordState.user?.name}
              </span>
            </p>
            {resetPasswordState.error && (
              <div className="mb-4 text-sm text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                {resetPasswordState.error}
              </div>
            )}
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="text"
                  required
                  value={resetPasswordState.newPassword}
                  onChange={(e) =>
                    setResetPasswordState((prev) => ({
                      ...prev,
                      newPassword: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter new password"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="resetMustChange"
                  checked={resetPasswordState.mustChange}
                  onChange={(e) =>
                    setResetPasswordState((prev) => ({
                      ...prev,
                      mustChange: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                />
                <label
                  htmlFor="resetMustChange"
                  className="text-sm font-medium text-slate-300"
                >
                  Must change on next login
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() =>
                    setResetPasswordState((prev) => ({
                      ...prev,
                      isOpen: false,
                    }))
                  }
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPasswordState.loading}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 transition-colors disabled:opacity-50"
                >
                  {resetPasswordState.loading ? "Saving..." : "Reset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
