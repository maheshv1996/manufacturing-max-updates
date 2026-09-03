"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Plus,
  Search,
  X,
  Pencil,
  Phone,
  Mail,
  UserPlus,
  Trash2,
  Star,
  AlertTriangle,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";
import { Card, CardHeader, CardContent, Button, Input, Select, StatusPill } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";

interface Contact {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
}

interface Customer {
  id: string;
  code: string;
  name: string;
  type: "DOMESTIC" | "EXPORT";
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  gstin: string | null;
  pan: string | null;
  paymentTerms: string;
  creditLimit: number;
  creditDays: number;
  currency: string;
  isActive: boolean;
  openReceivable: number;
  orderCount: number;
  contacts: Contact[];
}

const fmt = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export default function CustomersClient() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, totalExposure: 0, openOrders: 0 });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [contactDraft, setContactDraft] = useState({ name: "", role: "", phone: "", email: "" });

  const load = () => {
    fetch("/api/commercial/customers")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setCustomers(d.customers);
          setStats(d.stats);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.code, c.contactPerson, c.city, c.gstin, c.pan]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [customers, query]);

  const openNew = () => {
    setForm({ type: "DOMESTIC", creditLimit: 0, creditDays: 30, currency: "INR", paymentTerms: "NET30" });
    setModalOpen(true);
  };

  const saveCustomer = async () => {
    if (!form.name?.trim()) {
      toast.error("Customer name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/commercial/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        toast.error(d.error || "Failed to create customer");
        return;
      }
      soundFx.playSuccess();
      toast.success(`Customer ${d.customer.code} created`);
      setModalOpen(false);
      load();
    } catch {
      toast.error("Failed to create customer");
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (c: Customer, action: "activate" | "hold" | "inactivate") => {
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/commercial/customers/${c.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        toast.error(d.error || "Action failed");
        return;
      }
      soundFx.playSuccess();
      toast.success(`${c.name} ${action === "activate" ? "activated" : action === "hold" ? "on hold" : "inactivated"}`);
      load();
    } catch {
      toast.error("Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const addContact = async (c: Customer) => {
    if (!contactDraft.name.trim()) {
      toast.error("Contact name required");
      return;
    }
    const res = await fetch(`/api/commercial/customers/${c.id}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", ...contactDraft }),
    });
    const d = await res.json();
    if (!res.ok || !d.success) {
      toast.error(d.error || "Failed to add contact");
      return;
    }
    soundFx.playSuccess();
    setContactDraft({ name: "", role: "", phone: "", email: "" });
    load();
  };

  const removeContact = async (c: Customer, contactId: string) => {
    const res = await fetch(`/api/commercial/customers/${c.id}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", contactId }),
    });
    if (res.ok) {
      soundFx.playSuccess();
      load();
    }
  };

  const setPrimary = async (c: Customer, contactId: string) => {
    const res = await fetch(`/api/commercial/customers/${c.id}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setPrimary", contactId }),
    });
    if (res.ok) {
      soundFx.playSuccess();
      load();
    }
  };

  const overLimit = (c: Customer) => c.creditLimit > 0 && c.openReceivable > c.creditLimit;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f: any) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Customer master with contacts, GST/PAN, credit limits and live receivable exposure."
        icon={<Users className="h-5 w-5 text-sky-500" />}
        iconTone="blue"
        badge={{ label: "CRM MASTER", tone: "new" }}
      >
        <Button variant="primary" onClick={openNew}>
          <Plus className="size-4" /> New Customer
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Customers</p>
          <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Active</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{stats.active}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Open Receivables</p>
          <p className="text-2xl font-black text-rose-400 mt-1">{fmt(stats.totalExposure)}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Open Orders</p>
          <p className="text-2xl font-black text-sky-400 mt-1">{stats.openOrders}</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Customer Register"
          subtitle={`${filtered.length} of ${customers.length}`}
          icon={<Users className="h-4 w-4" />}
          action={
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, GSTIN, city…"
                className="w-64 bg-slate-900/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          }
        />
        <CardContent className="!p-0">
          <div className="max-h-[640px] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-10 text-center text-slate-400">Loading customers…</p>
            ) : filtered.length === 0 ? (
              <p className="px-4 py-10 text-center text-slate-400">No customers yet — create your first.</p>
            ) : (
              filtered.map((c) => (
                <div key={c.id} className="border-b border-white/5">
                  <div className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors">
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    >
                      <div className="flex items-center gap-2.5">
                        <p className="font-medium text-white truncate">{c.name}</p>
                        {overLimit(c) && (
                          <AlertTriangle className="size-3.5 text-rose-400 shrink-0" />
                        )}
                        <StatusPill variant={c.isActive ? "success" : "neutral"} label={c.isActive ? "ACTIVE" : "INACTIVE"} />
                        {c.type === "EXPORT" && <StatusPill variant="info" label="EXPORT" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <span className="font-mono">{c.code}</span>
                        {c.gstin ? ` · GST ${c.gstin}` : ""}
                        {c.city ? ` · ${c.city}` : ""}
                        {c.contactPerson ? ` · ${c.contactPerson}` : ""}
                      </p>
                    </button>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Open</p>
                        <p className={`font-mono text-sm font-bold ${overLimit(c) ? "text-rose-400" : "text-slate-200"}`}>
                          {fmt(c.openReceivable)}
                        </p>
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="text-xs text-slate-500">Limit</p>
                        <p className="font-mono text-sm text-slate-300">{c.creditLimit ? fmt(c.creditLimit) : "—"}</p>
                      </div>
                      <Button variant="ghost" size="icon" title="Hold / activate" isLoading={busyId === c.id} onClick={() => setActive(c, c.isActive ? "hold" : "activate")}>
                        <Pencil className="size-4" />
                      </Button>
                    </div>
                  </div>
                  {expanded === c.id && (
                    <div className="px-6 pb-5 grid md:grid-cols-2 gap-6 bg-white/[0.02]">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                          Account
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          <span className="text-slate-500">Payment terms</span>
                          <span className="text-slate-200">{c.paymentTerms}</span>
                          <span className="text-slate-500">Credit limit</span>
                          <span className="text-slate-200">{c.creditLimit ? fmt(c.creditLimit) : "None"}</span>
                          <span className="text-slate-500">Credit days</span>
                          <span className="text-slate-200">{c.creditDays}</span>
                          <span className="text-slate-500">Currency</span>
                          <span className="text-slate-200">{c.currency}</span>
                          <span className="text-slate-500">PAN</span>
                          <span className="text-slate-200 font-mono">{c.pan || "—"}</span>
                          <span className="text-slate-500">Orders</span>
                          <span className="text-slate-200">{c.orderCount}</span>
                        </div>
                        {c.phone && (
                          <p className="flex items-center gap-1.5 text-sm text-slate-300 mt-2">
                            <Phone className="size-3.5 text-slate-500" /> {c.phone}
                          </p>
                        )}
                        {c.email && (
                          <p className="flex items-center gap-1.5 text-sm text-slate-300 mt-1">
                            <Mail className="size-3.5 text-slate-500" /> {c.email}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                          Contacts ({c.contacts.length})
                        </p>
                        <div className="space-y-2 mb-3">
                          {c.contacts.map((ct) => (
                            <div key={ct.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
                              <div className="min-w-0">
                                <p className="text-sm text-slate-200 flex items-center gap-1.5">
                                  {ct.name} {ct.isPrimary && <Star className="size-3 text-amber-400 fill-amber-400" />}
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                  {[ct.role, ct.phone, ct.email].filter(Boolean).join(" · ") || "No details"}
                                </p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                {!ct.isPrimary && (
                                  <Button variant="ghost" size="icon" title="Set primary" onClick={() => setPrimary(c, ct.id)}>
                                    <Star className="size-3.5" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" title="Remove" onClick={() => removeContact(c, ct.id)}>
                                  <Trash2 className="size-3.5 text-rose-400" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          {c.contacts.length === 0 && (
                            <p className="text-xs text-slate-500">No contacts recorded.</p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Name" value={contactDraft.name} onChange={(e) => setContactDraft((f) => ({ ...f, name: e.target.value }))} />
                          <Input placeholder="Role" value={contactDraft.role} onChange={(e) => setContactDraft((f) => ({ ...f, role: e.target.value }))} />
                          <Input placeholder="Phone" value={contactDraft.phone} onChange={(e) => setContactDraft((f) => ({ ...f, phone: e.target.value }))} />
                          <Input placeholder="Email" value={contactDraft.email} onChange={(e) => setContactDraft((f) => ({ ...f, email: e.target.value }))} />
                        </div>
                        <Button variant="glass" size="sm" className="mt-2" onClick={() => addContact(c)}>
                          <UserPlus className="size-3.5" /> Add Contact
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* New customer modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h3 className="font-semibold text-white">New Customer</h3>
                <p className="text-xs text-slate-400">Master record — credit, tax and contact data</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 grid sm:grid-cols-2 gap-4">
              <Input label="Company Name *" value={form.name || ""} onChange={set("name")} placeholder="e.g. Bharat Dynamics Ltd" />
              <Select label="Type" value={form.type || "DOMESTIC"} onChange={set("type")}>
                <option value="DOMESTIC">Domestic</option>
                <option value="EXPORT">Export</option>
              </Select>
              <Input label="GSTIN" value={form.gstin || ""} onChange={set("gstin")} placeholder="27AABCU9603R1ZM" />
              <Input label="PAN" value={form.pan || ""} onChange={set("pan")} />
              <Input label="Contact Person" value={form.contactName || ""} onChange={set("contactName")} />
              <Input label="Phone" value={form.phone || ""} onChange={set("phone")} />
              <Input label="Email" value={form.email || ""} onChange={set("email")} />
              <Input label="City" value={form.city || ""} onChange={set("city")} />
              <Input label="State" value={form.state || ""} onChange={set("state")} />
              <div className="sm:col-span-2">
                <Input label="Billing Address" value={form.address || ""} onChange={set("address")} />
              </div>
              <div className="sm:col-span-2">
                <Input label="Shipping Address (if different)" value={form.shippingAddress || ""} onChange={set("shippingAddress")} />
              </div>
              <Select label="Payment Terms" value={form.paymentTerms || "NET30"} onChange={set("paymentTerms")}>
                {["CAD", "NET15", "NET30", "NET45", "NET60", "ADVANCE"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
              <Input label="Currency" value={form.currency || "INR"} onChange={set("currency")} />
              <Input label="Credit Limit (₹)" type="number" min="0" value={form.creditLimit || ""} onChange={set("creditLimit")} />
              <Input label="Credit Days" type="number" min="0" max="365" value={form.creditDays || 30} onChange={set("creditDays")} />
              <div className="sm:col-span-2">
                <Input label="Notes" value={form.notes || ""} onChange={set("notes")} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="success" onClick={saveCustomer} isLoading={saving}>
                Create Customer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}