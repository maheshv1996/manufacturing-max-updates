"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  AlertTriangle,
  ClipboardList,
  Send,
  FileText,
} from "lucide-react";
import { Button, Input, Select } from "@/app/components/ui";

interface Requisition {
  id: string;
  reqNumber: string;
  title: string;
  description: string | null;
  status: string;
  urgency: string;
  itemName: string | null;
  qty: number | null;
  unit: string | null;
  estimatedCost: number | null;
  poNumber: string | null;
  assignedByName: string | null;
  requestedBy: string;
  assignedTo: { id: string; name: string } | null;
  followUps: { id: string; note: string; by: string; at: string }[];
}
interface UserRow {
  id: string;
  name: string;
  employeeNumber: string | null;
}
interface OverduePo {
  id: string;
  poNumber: string;
  supplier: { name: string } | null;
  expectedDate: string;
  status: string;
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  ASSIGNED: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  IN_PROGRESS: "bg-indigo-500/15 text-indigo-300 border-indigo-500/40",
  PO_ISSUED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  CANCELLED: "bg-rose-500/15 text-rose-300 border-rose-500/40",
};
const URGENCY_STYLE: Record<string, string> = {
  NORMAL: "text-slate-400",
  URGENT: "text-amber-300",
  CRITICAL: "text-rose-300",
};

export default function BuyerBoardClient() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [overduePos, setOverduePos] = useState<OverduePo[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  // create form
  const [newTitle, setNewTitle] = useState("");
  const [newItem, setNewItem] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newUrgency, setNewUrgency] = useState("NORMAL");
  // action forms
  const [buyerFor, setBuyerFor] = useState("");
  const [noteFor, setNoteFor] = useState<Record<string, string>>({});
  const [poFor, setPoFor] = useState<Record<string, string>>({});

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/buyer-board");
      const data = await res.json();
      setRequisitions(data.requisitions || []);
      setUsers(data.users || []);
      setOverduePos(data.overduePos || []);
      setStats(data.stats || {});
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const act = async (action: string, payload: any) => {
    setMsg("");
    setBusy(action + ":" + (payload.id || ""));
    try {
      const res = await fetch("/api/buyer-board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: payload }),
      });
      const data = await res.json();
      setMsg(res.ok ? "Done" : data.error || "Action failed");
      if (res.ok) {
        setNewTitle("");
        setNewItem("");
        setNewQty("");
        setNewCost("");
        await fetchAll();
      }
    } catch {
      setMsg("Network error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-emerald-300 font-semibold">{msg}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: "Open requisitions",
            value: stats.open ?? "—",
            icon: <ClipboardList className="h-5 w-5 text-sky-500" />,
          },
          {
            label: "Assigned to buyers",
            value: stats.assigned ?? "—",
            icon: <Users className="h-5 w-5 text-amber-500" />,
          },
          {
            label: "POs issued",
            value: stats.poIssued ?? "—",
            icon: <FileText className="h-5 w-5 text-emerald-500" />,
          },
          {
            label: "Overdue POs",
            value: stats.overduePo ?? "—",
            icon: <AlertTriangle className="h-5 w-5 text-rose-500" />,
            tone: (stats.overduePo || 0) > 0 ? "text-rose-500" : undefined,
          },
          {
            label: "Critical open",
            value: stats.critical ?? "—",
            icon: <AlertTriangle className="h-5 w-5 text-rose-500" />,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 flex items-center gap-3"
          >
            {k.icon}
            <div>
              <p className={`text-2xl font-black text-white ${k.tone || ""}`}>
                {k.value}
              </p>
              <p className="text-xs text-slate-400">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {overduePos.length > 0 && (
        <section className="rounded-2xl bg-rose-950/20 border border-rose-500/30 p-4 space-y-2">
          <h3 className="font-bold text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Overdue purchase orders —
            buyer reminder ({overduePos.length})
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {overduePos.map((p) => (
              <div
                key={p.id}
                className="rounded-xl bg-slate-800/60 border border-slate-700 px-3 py-2 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {p.poNumber}
                  </p>
                  <p className="text-xs text-slate-400">
                    {p.supplier?.name || "—"}
                  </p>
                </div>
                <span className="text-xs text-rose-300 font-bold">
                  {new Date(p.expectedDate).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4 space-y-3">
        <h3 className="font-bold text-white flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-sky-400" /> New purchase
          requisition
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <Input
            placeholder="Title (required)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="lg:col-span-2"
          />
          <Input
            placeholder="Item / material"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Qty"
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Est. cost ₹"
            value={newCost}
            onChange={(e) => setNewCost(e.target.value)}
          />
          <Select
            value={newUrgency}
            onChange={(e) => setNewUrgency(e.target.value)}
          >
            <option value="NORMAL">Normal</option>
            <option value="URGENT">Urgent</option>
            <option value="CRITICAL">Critical</option>
          </Select>
        </div>
        <Button
          onClick={() =>
            act("create", {
              title: newTitle,
              itemName: newItem,
              qty: newQty,
              estimatedCost: newCost,
              urgency: newUrgency,
            })
          }
          disabled={!newTitle || busy !== null}
        >
          <Send className="w-4 h-4" /> Create requisition
        </Button>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-white">Requisition Board</h3>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : requisitions.length === 0 ? (
          <p className="text-sm text-slate-400 rounded-2xl bg-slate-800/40 border border-slate-800 p-4">
            No requisitions yet.
          </p>
        ) : (
          requisitions.map((r) => (
            <details
              key={r.id}
              className="rounded-2xl bg-slate-800/60 border border-slate-700 p-4"
            >
              <summary className="cursor-pointer flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className={`w-2 h-2 rounded-full ${r.status === "PO_ISSUED" ? "bg-emerald-400" : r.status === "CANCELLED" ? "bg-rose-400" : r.status === "ASSIGNED" || r.status === "IN_PROGRESS" ? "bg-amber-400" : "bg-sky-400"}`}
                  />
                  <span className="font-bold text-white">{r.reqNumber}</span>
                  <span className="text-sm text-slate-200">{r.title}</span>
                  <span
                    className={`text-xs font-bold ${URGENCY_STYLE[r.urgency]}`}
                  >
                    {r.urgency}
                  </span>
                  <span className="text-xs text-slate-400">
                    {r.requestedBy}
                    {r.assignedByName ? ` → ${r.assignedByName}` : ""}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full border text-xs font-bold ${STATUS_STYLE[r.status]}`}
                >
                  {r.status}
                  {r.poNumber ? ` · ${r.poNumber}` : ""}
                </span>
              </summary>
              <div className="mt-3 space-y-3">
                {r.itemName && (
                  <p className="text-sm text-slate-300">
                    {r.itemName}
                    {r.qty ? ` × ${r.qty} ${r.unit || ""}` : ""}
                    {r.estimatedCost
                      ? ` · est ₹${r.estimatedCost.toLocaleString("en-IN")}`
                      : ""}
                  </p>
                )}
                {r.description && (
                  <p className="text-xs text-slate-400">{r.description}</p>
                )}

                {r.status === "OPEN" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select
                      value={buyerFor}
                      onChange={(e) => setBuyerFor(e.target.value)}
                      className="w-56"
                    >
                      <option value="">Assign buyer…</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                          {u.employeeNumber ? ` (${u.employeeNumber})` : ""}
                        </option>
                      ))}
                    </Select>
                    <Button
                      onClick={() =>
                        act("assign", {
                          id: r.id,
                          buyerId: buyerFor,
                          reason: "Assigned by buyer board.",
                        })
                      }
                      disabled={!buyerFor || busy !== null}
                      size="sm"
                    >
                      <Users className="w-4 h-4" /> Assign
                    </Button>
                    <Button
                      onClick={() =>
                        act("cancel", {
                          id: r.id,
                          reason: "Cancelled by board.",
                        })
                      }
                      disabled={busy !== null}
                      variant="outline"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                )}

                {(r.status === "ASSIGNED" || r.status === "IN_PROGRESS") && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      placeholder="Follow-up note… (e.g. chased supplier for ETA)"
                      value={noteFor[r.id] || ""}
                      onChange={(e) =>
                        setNoteFor((m) => ({ ...m, [r.id]: e.target.value }))
                      }
                      className="flex-1 min-w-52"
                    />
                    <Button
                      onClick={() =>
                        act("followUp", { id: r.id, note: noteFor[r.id] })
                      }
                      disabled={!noteFor[r.id] || busy !== null}
                      size="sm"
                    >
                      <FileText className="w-4 h-4" /> Log follow-up
                    </Button>
                    <Input
                      placeholder="PO number (PO-…)"
                      value={poFor[r.id] || ""}
                      onChange={(e) =>
                        setPoFor((m) => ({ ...m, [r.id]: e.target.value }))
                      }
                      className="w-40"
                    />
                    <Button
                      onClick={() =>
                        act("issuePo", {
                          id: r.id,
                          poNumber: poFor[r.id],
                          reason: "PO issued to supplier.",
                        })
                      }
                      disabled={!poFor[r.id] || busy !== null}
                      size="sm"
                    >
                      <Send className="w-4 h-4" /> Issue PO
                    </Button>
                  </div>
                )}

                {r.followUps.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">
                      Follow-up log
                    </p>
                    {r.followUps.map((f) => (
                      <p key={f.id} className="text-xs text-slate-300">
                        <span className="text-slate-500">
                          {new Date(f.at).toLocaleString()} · {f.by}:
                        </span>{" "}
                        {f.note}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </details>
          ))
        )}
      </section>
    </div>
  );
}
