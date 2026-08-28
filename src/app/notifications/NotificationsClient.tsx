"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

type Notif = {
  id: string;
  title: string;
  description: string;
  type: "danger" | "warning" | "info";
  link: string;
  time: string;
  read: boolean;
};

export default function NotificationsClient() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const d = await res.json();
        setItems(d.notifications || []);
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

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    setBusy(true);
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: ids }),
      });
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const unread = items.filter((n) => !n.read);
  const read = items.filter((n) => n.read);

  const iconFor = (n: Notif) => {
    if (n.type === "danger")
      return <AlertCircle className="w-5 h-5 text-rose-500" />;
    if (n.type === "warning")
      return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    return <Bell className="w-5 h-5 text-blue-500" />;
  };

  const Card = ({ n }: { n: Notif }) => (
    <div
      className={`bg-slate-800/60 rounded-2xl border p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 ${
        n.read
          ? "border-slate-700"
          : "border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/10"
      }`}
    >
      <div className="shrink-0 p-2.5 rounded-xl bg-slate-800/60">
        {iconFor(n)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-white">{n.title}</h3>
          {n.read ? (
            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-slate-800/60 text-slate-400">
              Read
            </span>
          ) : (
            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-rose-600 text-white">
              New
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400 mt-0.5">{n.description}</p>
        <div className="text-[11px] text-slate-400 mt-1">
          {new Date(n.time).toLocaleString()}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={n.link}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
        >
          Open <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        {!n.read && (
          <button
            onClick={() => markRead([n.id])}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-400 rounded-lg text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledge
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Bell className="w-4 h-4" />
          <span>
            <strong className="text-white">{unread.length}</strong> unread of{" "}
            {items.length} notifications
          </span>
        </div>
        {unread.length > 0 && (
          <button
            onClick={() => markRead(unread.map((n) => n.id))}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />{" "}
            {busy ? "Working..." : "Mark All Read"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700 p-12 text-center space-y-3">
          <Bell className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-slate-400 italic">
            You&apos;re all caught up â€” no open notifications.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {unread.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-rose-500">
                Needs Attention
              </h2>
              {unread.map((n) => (
                <Card key={n.id} n={n} />
              ))}
            </div>
          )}
          {read.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Acknowledged
              </h2>
              {read.map((n) => (
                <Card key={n.id} n={n} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
