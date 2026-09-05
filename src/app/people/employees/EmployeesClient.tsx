"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Plus,
  Pencil,
  LogOut,
  Undo2,
  Search,
  X,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";
import { Card, CardHeader, CardContent, Button, Input, Select, StatusPill } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";

interface Employee {
  id: string;
  employeeNumber: string;
  name: string;
  designation: string | null;
  department: string | null;
  doj: string | null;
  dob: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  panNumber: string | null;
  aadhaarNumber: string | null;
  pfUan: string | null;
  esiNumber: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  address: string | null;
  bloodGroup: string | null;
  emergencyContact: string | null;
  status: "ACTIVE" | "ON_HOLD" | "EXITED";
  exitReason: string | null;
  user: { id: string; username: string | null; isActive: boolean } | null;
}

interface FormState {
  employeeNumber: string;
  name: string;
  designation: string;
  department: string;
  doj: string;
  dob: string;
  gender: string;
  phone: string;
  email: string;
  panNumber: string;
  aadhaarNumber: string;
  pfUan: string;
  esiNumber: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  address: string;
  bloodGroup: string;
  emergencyContact: string;
}

const EMPTY_FORM: FormState = {
  employeeNumber: "",
  name: "",
  designation: "",
  department: "",
  doj: "",
  dob: "",
  gender: "",
  phone: "",
  email: "",
  panNumber: "",
  aadhaarNumber: "",
  pfUan: "",
  esiNumber: "",
  bankName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  address: "",
  bloodGroup: "",
  emergencyContact: "",
};

const toDateInput = (v: string | null) => (v ? String(v).slice(0, 10) : "");

export default function EmployeesClient() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, onHold: 0, exited: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen]);

  const load = () => {
    fetch("/api/people/employees")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setEmployees(data.employees);
          setStats(data.stats);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.employeeNumber, e.name, e.designation, e.department, e.panNumber, e.pfUan]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [employees, query]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (e: Employee) => {
    setEditing(e);
    setForm({
      employeeNumber: e.employeeNumber,
      name: e.name,
      designation: e.designation || "",
      department: e.department || "",
      doj: toDateInput(e.doj),
      dob: toDateInput(e.dob),
      gender: e.gender || "",
      phone: e.phone || "",
      email: e.email || "",
      panNumber: e.panNumber || "",
      aadhaarNumber: e.aadhaarNumber || "",
      pfUan: e.pfUan || "",
      esiNumber: e.esiNumber || "",
      bankName: e.bankName || "",
      bankAccountNumber: e.bankAccountNumber || "",
      bankIfsc: e.bankIfsc || "",
      address: e.address || "",
      bloodGroup: e.bloodGroup || "",
      emergencyContact: e.emergencyContact || "",
    });
    setModalOpen(true);
  };

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.employeeNumber.trim() || !form.name.trim()) {
      toast.error("Employee number and name are required");
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/people/employees/${editing.id}` : "/api/people/employees";
      const method = editing ? "PATCH" : "POST";
      const payload: any = { ...form };
      if (editing) delete payload.employeeNumber; // code is immutable — identity key
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to save employee");
        return;
      }
      soundFx.playSuccess();
      toast.success(editing ? "Employee updated" : `Employee ${data.employee.employeeNumber} created`);
      setModalOpen(false);
      load();
    } catch {
      toast.error("Failed to save employee");
    } finally {
      setSaving(false);
    }
  };

  const handleExit = async (e: Employee) => {
    if (!window.confirm(`Mark ${e.employeeNumber} ${e.name} as EXITED? This records the exit but keeps the record.`)) return;
    setBusyId(e.id);
    try {
      const res = await fetch(`/api/people/employees/${e.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "exit", reason: "Exit recorded from employee register" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to mark exit");
        return;
      }
      soundFx.playSuccess();
      toast.success(`${e.name} marked as exited`);
      load();
    } catch {
      toast.error("Failed to mark exit");
    } finally {
      setBusyId(null);
    }
  };

  const handleReactivate = async (e: Employee) => {
    setBusyId(e.id);
    try {
      const res = await fetch(`/api/people/employees/${e.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to reactivate");
        return;
      }
      soundFx.playSuccess();
      toast.success(`${e.name} reactivated`);
      load();
    } catch {
      toast.error("Failed to reactivate");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Master"
        description="The HR master data the platform was missing — statutory identifiers (PAN, Aadhaar, PF UAN, ESI), bank details, join dates and employment status, linked to shopfloor badge users."
        icon={<Users className="h-5 w-5 text-indigo-500" />}
        iconTone="indigo"
        badge={{ label: "HR MASTER", tone: "new" }}
      >
        <Button variant="primary" onClick={openCreate}>
          <Plus className="size-4" /> Add Employee
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Headcount</p>
          <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Active</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{stats.active}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">On Hold</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{stats.onHold}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Exited</p>
          <p className="text-2xl font-black text-rose-400 mt-1">{stats.exited}</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Employee Register"
          subtitle={`${filtered.length} of ${employees.length} records`}
          icon={<Users className="h-4 w-4" />}
          action={
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, code, PAN, UAN…"
                className="w-64 bg-slate-900/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          }
        />
        <CardContent className="!p-0">
          <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-xl">
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-white/10">
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Designation</th>
                  <th className="px-4 py-3 font-semibold">Dept</th>
                  <th className="px-4 py-3 font-semibold">DOJ</th>
                  <th className="px-4 py-3 font-semibold">PAN</th>
                  <th className="px-4 py-3 font-semibold">PF UAN</th>
                  <th className="px-4 py-3 font-semibold">Bank</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                      Loading employee master…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                      No employees match — add your first employee.
                    </td>
                  </tr>
                ) : (
                  filtered.map((e) => (
                    <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-white">{e.name}</p>
                        <p className="text-xs text-slate-500 font-mono">
                          {e.employeeNumber}
                          {e.user ? " · linked" : ""}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">{e.designation || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-300">{e.department || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-300">{toDateInput(e.doj) || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-300">{e.panNumber || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-300">{e.pfUan || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-300">
                        {e.bankName ? (
                          <span className="block max-w-[160px] truncate">{e.bankName}</span>
                        ) : (
                          "—"
                        )}
                        {e.bankIfsc && <span className="text-xs text-slate-500 font-mono">{e.bankIfsc}</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill
                          variant={e.status === "ACTIVE" ? "success" : e.status === "ON_HOLD" ? "warning" : "neutral"}
                          label={e.status}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(e)}>
                            <Pencil className="size-4" />
                          </Button>
                          {e.status === "ACTIVE" ? (
                            <Button variant="ghost" size="icon" title="Mark exited" isLoading={busyId === e.id} onClick={() => handleExit(e)}>
                              <LogOut className="size-4 text-rose-400" />
                            </Button>
                          ) : e.status === "EXITED" ? (
                            <Button variant="ghost" size="icon" title="Reactivate" isLoading={busyId === e.id} onClick={() => handleReactivate(e)}>
                              <Undo2 className="size-4 text-emerald-400" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-modal-title"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h3 id="employee-modal-title" className="font-semibold text-white">{editing ? "Edit Employee" : "Add Employee"}</h3>
                <p className="text-xs text-slate-400">
                  {editing ? `Updating ${editing.employeeNumber} — employee number is immutable` : "Statutory + bank master data"}
                </p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 grid sm:grid-cols-2 gap-4">
              <Input label="Employee Number *" value={form.employeeNumber} onChange={set("employeeNumber")} disabled={!!editing} placeholder="e.g. 1001" />
              <Input label="Full Name *" value={form.name} onChange={set("name")} placeholder="e.g. Rajesh Kumar" />
              <Input label="Designation" value={form.designation} onChange={set("designation")} placeholder="e.g. CNC Turner" />
              <Input label="Department" value={form.department} onChange={set("department")} placeholder="e.g. Production" />
              <Input label="Date of Joining" type="date" value={form.doj} onChange={set("doj")} />
              <Input label="Date of Birth" type="date" value={form.dob} onChange={set("dob")} />
              <Select label="Gender" value={form.gender} onChange={set("gender")}>
                <option value="">—</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </Select>
              <Input label="Phone" value={form.phone} onChange={set("phone")} placeholder="+91 98xxxxxx" />
              <Input label="Email" type="email" value={form.email} onChange={set("email")} placeholder="name@company.com" />
              <Input label="PAN" value={form.panNumber} onChange={set("panNumber")} placeholder="ABCDE1234F" />
              <Input label="Aadhaar" value={form.aadhaarNumber} onChange={set("aadhaarNumber")} placeholder="12 digits" />
              <Input label="PF UAN" value={form.pfUan} onChange={set("pfUan")} placeholder="e.g. 101234567890" />
              <Input label="ESI Number" value={form.esiNumber} onChange={set("esiNumber")} />
              <Input label="Bank Name" value={form.bankName} onChange={set("bankName")} placeholder="e.g. State Bank of India" />
              <Input label="Bank Account Number" value={form.bankAccountNumber} onChange={set("bankAccountNumber")} />
              <Input label="IFSC" value={form.bankIfsc} onChange={set("bankIfsc")} placeholder="SBIN0001234" />
              <Input label="Blood Group" value={form.bloodGroup} onChange={set("bloodGroup")} placeholder="B+" />
              <Input label="Emergency Contact" value={form.emergencyContact} onChange={set("emergencyContact")} />
              <div className="sm:col-span-2">
                <Input label="Address" value={form.address} onChange={set("address")} placeholder="Residential address" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="success" onClick={handleSave} isLoading={saving}>
                {editing ? "Save Changes" : "Create Employee"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}