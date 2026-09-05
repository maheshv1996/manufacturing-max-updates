"use client";

import PageHeader from "@/app/components/shared/PageHeader";


import {logClientError } from "@/lib/clientLogger";
import { useState, useEffect, useCallback } from "react";
import {
  Megaphone,
  Users,
  Globe,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronRight,
  Save,
  FileText
} from "lucide-react";

type Campaign = any;
type Lead = any;

const CAMP_STATUS: Record<string, string> = {
  PLANNED: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  PAUSED: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  COMPLETED: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
};
const LEAD_STATUS: Record<string, string> = {
  NEW: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  CONTACTED: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30",
  QUALIFIED: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  PROPOSAL: "bg-purple-500/10 text-purple-400 border border-purple-500/30",
  WON: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  LOST: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
};
const NEXT_LEAD: Record<string, string> = {
  NEW: "CONTACTED",
  CONTACTED: "QUALIFIED",
  QUALIFIED: "PROPOSAL",
  PROPOSAL: "WON",
};
const badge = (k: string) =>
  LEAD_STATUS[k] ||
  CAMP_STATUS[k] ||
  "bg-slate-500/10 text-slate-400 border border-slate-500/30";

const LANDING_DEFAULTS = {
  appName: "Manufacturing Max",
  badge: "Manufacturing Max",
  heroLines: ["THE DIGITAL NERVOUS", "SYSTEM OF YOUR FACTORY"],
  heroSubtitle:
    "Track OEE in real-time, eliminate downtime, and run your shop floor seamlessly with our all-in-one digital manufacturing platform.",
  ctaPrimary: "View Plans",
  ctaSecondary: "Sign In",
  stats: [
    { value: 140, suffix: "+", label: "Features" },
    { value: 13, suffix: "", label: "Reports" },
    { value: 9, suffix: "", label: "Departments" },
    { value: 3, suffix: "", label: "Plants" },
  ],
};

interface Field {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "textarea";
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

export default function MarketingClient() {
  const [tab, setTab] = useState<"campaigns" | "leads" | "landing">(
    "campaigns",
  );
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [landing, setLanding] = useState<any>(LANDING_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [modal, setModal] = useState<{ entity: string; row: any } | null>(null);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modal) {
        setModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/marketing");
      if (res.ok) {
        const d = await res.json();
        setCampaigns(d.campaigns || []);
        setLeads(d.leads || []);
        if (d.landing) setLanding(d.landing);
      }
    } catch (e) {
      logClientError(e, "MarketingClient");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const api = async (entity: string | null, action: string, data: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, action, data }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) alert(d.error || "Action failed");
      else await fetchData();
    } catch (e) {
      logClientError(e, "MarketingClient");
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
      if (f.type === "number") v = v ?? "";
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

  const saveLanding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveLanding", data: landing }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) alert(d.error || "Save failed");
      else {
        setSavedMsg("Landing page saved — live at /landing.");
        setTimeout(() => setSavedMsg(""), 4000);
      }
    } catch (err) {
      logClientError(err, "MarketingClient");
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const CAMP_FIELDS: Field[] = [
    { key: "name", label: "Campaign Name", required: true },
    {
      key: "channel",
      label: "Channel",
      type: "select",
      options: ["DIGITAL", "EMAIL", "TRADE_SHOW", "PRINT", "REFERRAL", "OTHER"],
    },
    { key: "budget", label: "Budget (₹)", type: "number" },
    { key: "spent", label: "Spent (₹)", type: "number" },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["PLANNED", "ACTIVE", "PAUSED", "COMPLETED"],
    },
    { key: "startDate", label: "Start Date", type: "date" },
    { key: "endDate", label: "End Date", type: "date" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const LEAD_FIELDS: Field[] = [
    { key: "contactName", label: "Contact Name", required: true },
    { key: "company", label: "Company", required: true },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    {
      key: "campaignId",
      label: "Campaign",
      type: "select",
      options: [
        { value: "", label: "No campaign" },
        ...campaigns.map((c) => ({ value: c.id, label: c.name })),
      ],
    },
    {
      key: "source",
      label: "Source",
      type: "select",
      options: [
        "",
        "REFERRAL",
        "LINKEDIN",
        "JOB_PORTAL",
        "CAMPUS",
        "AGENCY",
        "WEBSITE",
        "OTHER",
      ],
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"],
    },
    { key: "value", label: "Estimated Value (₹)", type: "number" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const updateLanding = (patch: any) => setLanding({ ...landing, ...patch });

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap print:hidden">
        {[
          { id: "campaigns" as const, label: "Campaigns", icon: Megaphone },
          { id: "leads" as const, label: "Leads", icon: Users },
          { id: "landing" as const, label: "Landing Page", icon: Globe },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                tab === t.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-800/60 text-slate-600 text-slate-300 hover:bg-slate-200 hover:bg-slate-700 border border-slate-600"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : tab === "campaigns" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openModal("campaigns", null, CAMP_FIELDS)}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> New Campaign
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns.length === 0 && (
              <div className="col-span-full text-center text-slate-400 italic py-10">
                No campaigns yet.
              </div>
            )}
            {campaigns.map((c) => {
              const pct =
                c.budget > 0
                  ? Math.min(100, Math.round((c.spent / c.budget) * 100))
                  : 0;
              return (
                <div
                  key={c.id}
                  className="bg-slate-800/60 rounded-2xl border border-slate-700 p-5 shadow-sm space-y-3"
                >
      <PageHeader
        title="Marketing"
        description="Quotes, orders, receivables and commercial desk operations."
        icon={<FileText className="w-6 h-6" />}
        iconTone="amber"
      />

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-white">{c.name}</h3>
                      <p className="text-xs text-slate-400">
                        {c.channel} ·{" "}
                        {c.startDate
                          ? new Date(c.startDate).toLocaleDateString()
                          : "—"}
                        {c.endDate
                          ? ` → ${new Date(c.endDate).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${badge(c.status)}`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
                      <span>
                        ₹{Number(c.spent).toLocaleString("en-IN")} / ₹
                        {Number(c.budget).toLocaleString("en-IN")}
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800/60 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    <strong className="text-white">
                      {c._count?.leads || 0}
                    </strong>{" "}
                    leads attributed
                  </div>
                  {c.notes && (
                    <p className="text-xs text-slate-400">{c.notes}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => openModal("campaigns", c, CAMP_FIELDS)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-200 hover:bg-slate-700 text-blue-400 rounded-lg text-xs font-bold"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => del("campaigns", c)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 hover:bg-rose-900/40 text-rose-400 rounded-lg text-xs font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : tab === "leads" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openModal("leads", null, LEAD_FIELDS)}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add Lead
            </button>
          </div>
          <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-800/60 border-b border-slate-700">
                <tr>
                  {[
                    "Contact",
                    "Company",
                    "Campaign",
                    "Source",
                    "Status",
                    "Value",
                    "Received",
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
                {leads.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-10 text-center text-slate-400 italic"
                    >
                      No leads yet — they also flow in from the /landing
                      contact form.
                    </td>
                  </tr>
                )}
                {leads.map((l) => (
                  <tr
                    key={l.id}
                    className="hover:bg-slate-800/90/20 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="font-bold text-white">
                        {l.contactName}
                      </div>
                      <div className="text-xs text-slate-400">
                        {l.email || l.phone || "—"}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-slate-300">
                      {l.company}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-slate-300">
                      {l.campaign?.name || "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-slate-300">
                      {l.source || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${badge(l.status)}`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-600 text-slate-300">
                      {l.value
                        ? `₹${Number(l.value).toLocaleString("en-IN")}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-400">
                      {new Date(l.at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        {NEXT_LEAD[l.status] && (
                          <button
                            onClick={() =>
                              api("leads", "update", {
                                id: l.id,
                                status: NEXT_LEAD[l.status],
                              })
                            }
                            className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-400 rounded-lg text-xs font-bold border border-blue-200 dark:border-blue-800"
                          >
                            <ChevronRight className="w-3.5 h-3.5 inline mr-1" />
                            {NEXT_LEAD[l.status]}
                          </button>
                        )}
                        <button
                          onClick={() => openModal("leads", l, LEAD_FIELDS)}
                          className="px-2.5 py-1.5 bg-slate-800/60 text-blue-400 rounded-lg text-xs font-bold"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => del("leads", l)}
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
        <form
          onSubmit={saveLanding}
          className="bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm p-6 space-y-5 max-w-3xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">
                Landing Page Content
              </h3>
              <p className="text-xs text-slate-400">
                Edits publish immediately to the public{" "}
                <a
                  href="/landing"
                  className="text-blue-400 underline"
                  target="_blank"
                >
                  /landing
                </a>{" "}
                page.
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Publish"}
            </button>
          </div>
          {savedMsg && (
            <div className="text-sm font-semibold text-emerald-400">
              {savedMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Brand Name (badge)
              </label>
              <input
                value={landing.badge || ""}
                onChange={(e) => updateLanding({ badge: e.target.value })}
                className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                App Name (footer)
              </label>
              <input
                value={landing.appName || ""}
                onChange={(e) => updateLanding({ appName: e.target.value })}
                className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Hero Line 1
              </label>
              <input
                value={(landing.heroLines || [])[0] || ""}
                onChange={(e) =>
                  updateLanding({
                    heroLines: [e.target.value, (landing.heroLines || [])[1]],
                  })
                }
                className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Hero Line 2
              </label>
              <input
                value={(landing.heroLines || [])[1] || ""}
                onChange={(e) =>
                  updateLanding({
                    heroLines: [(landing.heroLines || [])[0], e.target.value],
                  })
                }
                className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Hero Subtitle
              </label>
              <textarea
                rows={3}
                value={landing.heroSubtitle || ""}
                onChange={(e) =>
                  updateLanding({ heroSubtitle: e.target.value })
                }
                className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Primary CTA
              </label>
              <input
                value={landing.ctaPrimary || ""}
                onChange={(e) => updateLanding({ ctaPrimary: e.target.value })}
                className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Secondary CTA
              </label>
              <input
                value={landing.ctaSecondary || ""}
                onChange={(e) =>
                  updateLanding({ ctaSecondary: e.target.value })
                }
                className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">
                Stat Counters
              </label>
              <button
                type="button"
                onClick={() =>
                  updateLanding({
                    stats: [
                      ...(landing.stats || []),
                      { value: 10, suffix: "", label: "New Stat" },
                    ],
                  })
                }
                className="text-xs font-bold text-blue-400"
              >
                + Add stat
              </button>
            </div>
            <div className="space-y-2">
              {(landing.stats || []).map((s: any, i: number) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_60px_1fr_auto] gap-2 items-center"
                >
                  <input
                    value={s.label}
                    onChange={(e) => {
                      const stats = [...(landing.stats || [])];
                      stats[i] = { ...stats[i], label: e.target.value };
                      updateLanding({ stats });
                    }}
                    placeholder="Label"
                    className="bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="number"
                    value={s.value}
                    onChange={(e) => {
                      const stats = [...(landing.stats || [])];
                      stats[i] = { ...stats[i], value: Number(e.target.value) };
                      updateLanding({ stats });
                    }}
                    className="bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                  />
                  <input
                    value={s.suffix || ""}
                    onChange={(e) => {
                      const stats = [...(landing.stats || [])];
                      stats[i] = { ...stats[i], suffix: e.target.value };
                      updateLanding({ stats });
                    }}
                    placeholder="+ / %"
                    className="bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateLanding({
                        stats: (landing.stats || []).filter(
                          (_: any, j: number) => j !== i,
                        ),
                      })
                    }
                    className="p-2 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>
      )}

      {/* MODAL */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketing-modal-title"
            className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 id="marketing-modal-title" className="text-lg font-bold text-white">
                {modal.row ? "Edit" : "New"} Record
              </h3>
              <button
                type="button"
                aria-label="Close dialog"
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
              {(modal.entity === "campaigns" ? CAMP_FIELDS : LEAD_FIELDS).map(
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
