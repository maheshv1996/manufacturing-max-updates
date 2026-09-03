"use client";

import { useEffect, useMemo, useState } from "react";
import { Megaphone, Plus, Pin, PinOff, Archive, RotateCcw, Trash2, X, AlertTriangle } from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";
import { Card, CardHeader, CardContent, Button, Input, Select, StatusPill } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";

interface Announcement {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  pinned: boolean;
  active: boolean;
  author: string | null;
  publishAt: string;
  expiresAt: string | null;
}

const CATEGORIES = ["GENERAL", "HR", "SAFETY", "QUALITY", "MAINTENANCE", "EVENT", "EMERGENCY"] as const;
const PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  GENERAL: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  HR: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  SAFETY: "bg-lime-500/15 text-lime-300 border-lime-500/30",
  QUALITY: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  MAINTENANCE: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  EVENT: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  EMERGENCY: "bg-rose-500/20 text-rose-300 border-rose-500/40",
};

const fmt = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

const fmtTime = (d: string) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AnnouncementsClient({ canEdit = true }: { canEdit?: boolean }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [stats, setStats] = useState({ total: 0, live: 0, pinned: 0 });
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    body: "",
    category: "GENERAL",
    priority: "NORMAL",
    pinned: false,
    expiresAt: "",
  });

  const load = () => {
    fetch("/api/system/announcements")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setItems(d.announcements);
          setStats(d.stats);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const visible = useMemo(() => items, [items]);
  const liveCount = visible.filter((a) => a.active).length;
  const expiredInList = visible.filter((a) => a.active && a.expiresAt && new Date(a.expiresAt) < new Date()).length;

  const act = async (id: string, action: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/system/announcements/${id}`, {
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
      toast.success(`Announcement ${action === "pin" ? "pinned" : action === "unpin" ? "unpinned" : action === "archive" ? "archived" : action === "activate" ? "restored" : "deleted"}`);
      load();
    } catch {
      toast.error("Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const handlePin = (a: Announcement) => act(a.id, a.pinned ? "unpin" : "pin");
  const handleArchive = (a: Announcement) => act(a.id, a.active ? "archive" : "activate");
  const handleDelete = async (a: Announcement) => {
    if (!window.confirm(`Delete "${a.title}" permanently?`)) return;
    await act(a.id, "delete");
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Title and message are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/system/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, expiresAt: form.expiresAt || null }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        toast.error(d.error || "Failed to post announcement");
        return;
      }
      soundFx.playSuccess();
      toast.success("Announcement published");
      setComposeOpen(false);
      setForm({ title: "", body: "", category: "GENERAL", priority: "NORMAL", pinned: false, expiresAt: "" });
      load();
    } catch {
      toast.error("Failed to post announcement");
    } finally {
      setSaving(false);
    }
  };

  const priorityBar: Record<string, string> = {
    NORMAL: "bg-slate-500",
    IMPORTANT: "bg-amber-400",
    URGENT: "bg-rose-500",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Announcements"
        description="Org-wide notices posted to every screen — shift alerts, safety alerts, quality freezes, events. Pin important ones so they stay on top until they expire."
        icon={<Megaphone className="h-5 w-5 text-rose-500" />}
        iconTone="rose"
        badge={{ label: "COMMS", tone: "new" }}
      >
        {canEdit && (
          <Button variant="primary" onClick={() => setComposeOpen(true)}>
            <Plus className="size-4" /> New Announcement
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Published</p>
          <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Live Now</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{stats.live}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Pinned</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{stats.pinned}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Expired Still Showing</p>
          <p className="text-2xl font-black text-rose-400 mt-1">{expiredInList}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">auto-hide on refresh</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Announcement Board"
          subtitle={`${liveCount} visible · pinned first`}
          icon={<Megaphone className="h-4 w-4" />}
        />
        <CardContent className="!p-0">
          <div className="max-h-[680px] overflow-y-auto divide-y divide-white/5">
            {loading ? (
              <p className="px-6 py-12 text-center text-slate-400">Loading announcements…</p>
            ) : visible.length === 0 ? (
              <p className="px-6 py-12 text-center text-slate-400">
                No announcements yet — post one to reach every screen.
              </p>
            ) : (
              visible.map((a) => {
                const liveNow = a.active && (!a.expiresAt || new Date(a.expiresAt) > new Date());
                return (
                  <div key={a.id} className={`relative px-6 py-4 ${a.pinned ? "bg-amber-500/[0.04]" : ""} ${!liveNow ? "opacity-55" : ""}`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${a.pinned ? "bg-amber-400" : priorityBar[a.priority]}`} />
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-white truncate">{a.title}</h3>
                          {a.pinned && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-full px-2 py-0.5">
                              <Pin className="size-3" /> Pinned
                            </span>
                          )}
                          <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${CATEGORY_COLORS[a.category] || CATEGORY_COLORS.GENERAL}`}>
                            {a.category}
                          </span>
                          <StatusPill
                            variant={a.priority === "URGENT" ? "danger" : a.priority === "IMPORTANT" ? "warning" : "neutral"}
                            label={a.priority}
                          />
                          {!liveNow && (
                            <StatusPill
                              variant={a.expiresAt && new Date(a.expiresAt) < new Date() ? "danger" : "neutral"}
                              label={a.expiresAt && new Date(a.expiresAt) < new Date() ? "EXPIRED" : "ARCHIVED"}
                            />
                          )}
                        </div>
                        <p className="text-sm text-slate-300 mt-1.5 whitespace-pre-wrap">{a.body}</p>
                        <p className="text-xs text-slate-500 mt-2">
                          {a.author ? `${a.author} · ` : ""}
                          {fmtTime(a.publishAt)}
                          {a.expiresAt ? ` · auto-hides ${fmt(a.expiresAt)}` : " · no expiry"}
                        </p>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" title={a.pinned ? "Unpin" : "Pin to top"} isLoading={busyId === a.id} onClick={() => handlePin(a)}>
                            {a.pinned ? <PinOff className="size-4 text-amber-400" /> : <Pin className="size-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" title={a.active ? "Archive" : "Restore"} isLoading={busyId === a.id} onClick={() => handleArchive(a)}>
                            {a.active ? <Archive className="size-4" /> : <RotateCcw className="size-4 text-emerald-400" />}
                          </Button>
                          <Button variant="ghost" size="icon" title="Delete" isLoading={busyId === a.id} onClick={() => handleDelete(a)}>
                            <Trash2 className="size-4 text-rose-400" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setComposeOpen(false)}>
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h3 className="font-semibold text-white">New Announcement</h3>
                <p className="text-xs text-slate-400">Reaches every screen the moment you publish</p>
              </div>
              <button onClick={() => setComposeOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <Input label="Title *" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Power shutdown Saturday 22:00–06:00" />
              <div className="grid grid-cols-3 gap-3">
                <Select label="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
                <Select label="Priority" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </Select>
                <Input label="Auto-hide on" type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Message *</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  rows={5}
                  placeholder="Full notice text shown to all employees…"
                  className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
                  className="rounded border-white/20 bg-slate-900 accent-amber-400"
                />
                <Pin className="size-3.5 text-amber-400" /> Pin to top of the board
              </label>
              <p className="flex items-start gap-1.5 text-xs text-slate-500">
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                Emergency notices should also be raised as an escalation so the on-call chain gets paged.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
              <Button variant="ghost" onClick={() => setComposeOpen(false)}>Cancel</Button>
              <Button variant="success" onClick={handleCreate} isLoading={saving}>
                Publish Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
