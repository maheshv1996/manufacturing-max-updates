"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Loader2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
} from "lucide-react";
import { differenceInDays, isPast } from "date-fns";

export default function CertificationsTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    operators: any[];
    machines: any[];
    certifications: any[];
  }>({ operators: [], machines: [], certifications: [] });

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    userId: "",
    machineId: "",
    validUntil: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/certifications");
      const json = await res.json();
      setData(json);
    } catch (e) {
      logClientError(e, "CertificationsTab");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/certifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowModal(false);
        fetchData();
      } else {
        alert("Failed to issue certification");
      }
    } catch (err) {
      logClientError(err, "CertificationsTab");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this certification?")) return;
    try {
      const res = await fetch(`/api/admin/certifications/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      logClientError(err, "CertificationsTab");
    }
  };

  const getCertStatus = (userId: string, machineId: string) => {
    const cert = data.certifications.find(
      (c) => c.userId === userId && c.machineId === machineId && c.isActive,
    );
    if (!cert) return null;

    if (cert.validUntil) {
      const expiryDate = new Date(cert.validUntil);
      if (isPast(expiryDate)) {
        return { status: "EXPIRED", cert };
      }
      const daysLeft = differenceInDays(expiryDate, new Date());
      if (daysLeft <= 30) {
        return { status: "EXPIRING", cert, daysLeft };
      }
    }
    return { status: "ACTIVE", cert };
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">
            Operator Certifications
          </h2>
          <p className="text-slate-500 text-sm">
            Matrix of active machine certifications and safety gates.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Issue Certification
        </button>
      </div>

      <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-800/60 border-b border-slate-700">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-200 sticky left-0 bg-slate-800/60">
                Operator
              </th>
              {data.machines.map((m) => (
                <th
                  key={m.id}
                  className="px-6 py-4 font-semibold text-slate-200 text-center"
                >
                  <div className="flex flex-col items-center">
                    <span>{m.code}</span>
                    <span className="text-xs font-normal text-slate-500">
                      {m.name}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {data.operators.map((op) => (
              <tr
                key={op.id}
                className="hover:bg-slate-800/90/20 transition-colors"
              >
                <td className="px-6 py-4 font-medium text-slate-200 sticky left-0 bg-slate-800/60">
                  {op.name}
                  <div className="text-xs font-normal text-slate-500">
                    {op.username}
                  </div>
                </td>
                {data.machines.map((m) => {
                  const certInfo = getCertStatus(op.id, m.id);
                  return (
                    <td key={m.id} className="px-6 py-4 text-center">
                      {!certInfo ? (
                        <div className="flex justify-center">
                          <XCircle className="w-5 h-5 text-slate-700" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 group relative">
                          {certInfo.status === "ACTIVE" && (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          )}
                          {certInfo.status === "EXPIRING" && (
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                          )}
                          {certInfo.status === "EXPIRED" && (
                            <XCircle className="w-5 h-5 text-rose-500" />
                          )}
                          <div className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-5 whitespace-nowrap bg-slate-800/60 px-2 py-1 rounded shadow border z-10 flex gap-2 items-center">
                            {certInfo.cert.validUntil
                              ? new Date(
                                  certInfo.cert.validUntil,
                                ).toLocaleDateString()
                              : "No Expiry"}
                            <button
                              onClick={() => handleRevoke(certInfo.cert.id)}
                              className="text-red-500 hover:text-red-700"
                              title="Revoke Certification"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">
                Issue Certification
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Operator
                </label>
                <select
                  required
                  value={formData.userId}
                  onChange={(e) =>
                    setFormData({ ...formData, userId: e.target.value })
                  }
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2"
                >
                  <option value="">Select Operator</option>
                  {data.operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.name} ({op.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Machine
                </label>
                <select
                  required
                  value={formData.machineId}
                  onChange={(e) =>
                    setFormData({ ...formData, machineId: e.target.value })
                  }
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2"
                >
                  <option value="">Select Machine</option>
                  {data.machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} - {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Valid Until (Optional)
                </label>
                <input
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) =>
                    setFormData({ ...formData, validUntil: e.target.value })
                  }
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2"
                  placeholder="e.g. Completed forklift safety course"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-400 hover:bg-slate-800/90 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {submitting ? "Issuing..." : "Issue Certification"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
