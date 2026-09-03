"use client";

import { useEffect, useState } from "react";
import { Wrench, RefreshCw, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "@/lib/toastStore";
import { Card, CardHeader, CardContent, Button, StatusPill } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";

interface Failure {
  auditId: string;
  sourceId: string;
  source: string;
  reason: string;
  memo: string;
  createdAt: string;
}

export default function GlRepairClient() {
  const [failures, setFailures] = useState<Failure[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/finance/gl-repair");
      if (res.ok) {
        const d = await res.json();
        setFailures(d.failures || []);
      }
    } catch {
      toast.error("Failed to load repair queue");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = async (f: Failure) => {
    setBusy(f.auditId);
    try {
      const res = await fetch("/api/finance/gl-repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", data: { auditId: f.auditId } }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Retry failed");
        return;
      }
      toast.success(d.message || "Auto-post repaired");
      await load();
    } catch {
      toast.error("Retry failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="GL Auto-Post Repair"
        description="Every failed automatic journal post is queued here with its full posting intent — retry once the underlying issue (e.g. a closed period) is fixed."
        icon={<Wrench className="h-5 w-5 text-amber-500" />}
        iconTone="amber"
        badge={{ label: "BACKFILL QUEUE", tone: "warn" }}
      />
      <Card>
        <CardHeader
          title="Failed Auto-Posts"
          subtitle={`${failures.length} awaiting repair`}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <CardContent className="!p-0">
          {loading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
            </div>
          ) : failures.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-slate-300 font-semibold">No failed auto-posts</p>
              <p className="text-xs text-slate-500 mt-1">
                All money events are posting to the ledger cleanly.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5 max-h-[640px] overflow-y-auto">
              {failures.map((f) => (
                <div key={f.auditId} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusPill variant="danger" label={f.source || "GL"} />
                      <span className="font-mono text-xs text-slate-300 truncate">{f.sourceId}</span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(f.createdAt).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className="text-sm text-white mt-1 truncate">{f.memo}</p>
                    <p className="text-xs text-rose-400 mt-0.5 truncate">{f.reason}</p>
                  </div>
                  <Button variant="primary" size="sm" isLoading={busy === f.auditId} onClick={() => retry(f)}>
                    <RefreshCw className="size-3.5" /> Retry
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
