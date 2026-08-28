"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Zap } from "lucide-react";

export default function EcoActions({ eco }: { eco: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(status: string) {
    if (!confirm(`Are you sure you want to mark this ECO as ${status}?`))
      return;
    setLoading(true);
    try {
      const res = await fetch(`/api/eco/${eco.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert("Failed to update status");
      }
    } catch (e) {
      console.error(e);
      alert("Error updating status");
    } finally {
      setLoading(false);
    }
  }

  async function implementChanges() {
    if (
      !confirm(
        "Are you sure you want to implement these changes? This will modify the BOM, Routings, and Documents.",
      )
    )
      return;
    setLoading(true);
    try {
      const res = await fetch(`/api/eco/${eco.id}/implement`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to implement changes");
      }
    } catch (e) {
      console.error(e);
      alert("Error implementing changes");
    } finally {
      setLoading(false);
    }
  }

  if (eco.status === "DRAFT") {
    return (
      <div className="flex items-center gap-2">
        <button
          disabled={loading}
          onClick={() => updateStatus("REJECTED")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-sm font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50"
        >
          <X className="w-4 h-4" />
          Reject
        </button>
        <button
          disabled={loading || eco.items.length === 0}
          onClick={() => updateStatus("APPROVED")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50"
          title={eco.items.length === 0 ? "Add items before approving" : ""}
        >
          <Check className="w-4 h-4" />
          Approve
        </button>
      </div>
    );
  }

  if (eco.status === "APPROVED") {
    return (
      <button
        disabled={loading}
        onClick={implementChanges}
        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50"
      >
        <Zap className="w-4 h-4" />
        Implement Change
      </button>
    );
  }

  return null;
}
