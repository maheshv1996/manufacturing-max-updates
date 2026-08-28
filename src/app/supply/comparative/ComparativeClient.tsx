"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Trophy,
  X,
  CheckCircle2,
  Scale,
} from "lucide-react";
import {
  Card,
  Button,
  StatusPill,
  KpiCard,
  Input,
  Select,
} from "@/app/components/ui";

interface Supplier {
  id: string;
  name: string;
}
interface RawMaterial {
  id: string;
  name: string;
  sku: string;
}
interface Quote {
  id: string;
  unitRate: number;
  leadDays: number;
  paymentTerms?: string | null;
  notes?: string | null;
  supplier: Supplier;
}
interface Statement {
  id: string;
  statementNumber: string;
  qty: number;
  requiredBy?: string | null;
  status: string;
  createdBy: string;
  rawMaterial: RawMaterial;
  quotes: Quote[];
  awardedQuoteId?: string | null;
}

const EMPTY_QUOTE = {
  supplierId: "",
  unitRate: "",
  leadDays: "7",
  paymentTerms: "NET30",
  notes: "",
};

export default function ComparativeClient() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({
    rawMaterialId: "",
    qty: "",
    requiredBy: "",
  });
  const [quoteRows, setQuoteRows] = useState<Record<string, any>[]>([
    { ...EMPTY_QUOTE },
  ]);
  const [awarding, setAwarding] = useState<{
    statement: Statement;
    quote: any;
  } | null>(null);
  const [awardReason, setAwardReason] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/comparative");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setStatements(json.statements || []);
      setMaterials(json.rawMaterials || []);
      setSuppliers(json.suppliers || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (payload: any) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/comparative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      return json;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const createStatement = async () => {
    const quotes = quoteRows.filter((q) => q.supplierId && q.unitRate);
    if (!form.rawMaterialId || !form.qty || quotes.length === 0) {
      setError("Material, qty and at least one completed quote are required.");
      return;
    }
    const json = await post({
      action: "create_statement",
      ...form,
      qty: String(form.qty),
      quotes,
    });
    if (json) {
      setCreateOpen(false);
      setForm({ rawMaterialId: "", qty: "", requiredBy: "" });
      setQuoteRows([{ ...EMPTY_QUOTE }]);
      await load();
    }
  };

  const openAddQuote = (statement: Statement) => {
    setAwarding({
      statement,
      quote: {
        ...EMPTY_QUOTE,
        id: "new",
        unitRate: 0,
        leadDays: 7,
        paymentTerms: "NET30",
        supplier: { id: "", name: "" },
      } as any,
    });
  };

  const removeQuote = async (_statement: Statement, quoteId: string) => {
    const res = await post({ action: "remove_quote", quoteId });
    if (res) await load();
  };

  const award = async () => {
    if (!awarding) return;
    const json = await post({
      action: "award",
      statementId: awarding.statement.id,
      quoteId: awarding.quote.id,
      reason: awardReason,
    });
    if (json) {
      setNotice(
        `${awarding.statement.statementNumber} awarded — PO ${json.purchaseOrder?.poNumber} created with approval status ${json.purchaseOrder?.approvalStatus || "APPROVED"}.`,
      );
      setAwarding(null);
      setAwardReason("");
      await load();
    }
  };

  const closeStatement = async (statement: Statement) => {
    const res = await post({ action: "close", statementId: statement.id });
    if (res) await load();
  };

  const open = statements.filter((s) => s.status === "OPEN");

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          title="Open Statements"
          value={open.length}
          tone="sky"
          icon={<Scale className="h-4 w-4" />}
        />
        <KpiCard
          title="Quotes in Play"
          value={open.reduce((a, s) => a + s.quotes.length, 0)}
          tone="amber"
          icon={<Plus className="h-4 w-4" />}
        />
        <KpiCard
          title="Awarded"
          value={statements.filter((s) => s.status === "AWARDED").length}
          tone="emerald"
          icon={<Trophy className="h-4 w-4" />}
        />
        <KpiCard
          title="Closed"
          value={statements.filter((s) => s.status === "CLOSED").length}
          tone="slate"
          icon={<X className="h-4 w-4" />}
        />
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-800/60 p-4">
          <div>
            <h3 className="font-semibold text-slate-100">Statements</h3>
            <p className="text-sm text-slate-500">
              Award the winning rate to raise a PO automatically.
            </p>
          </div>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New Statement
          </Button>
        </div>

        <div className="divide-y divide-slate-800/60">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading
              statements…
            </div>
          ) : statements.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              No comparative statements yet.
            </div>
          ) : (
            statements.map((st) => (
              <div key={st.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-100">
                        {st.statementNumber}
                      </span>
                      <StatusPill
                        variant={
                          st.status === "OPEN"
                            ? "info"
                            : st.status === "AWARDED"
                              ? "success"
                              : "neutral"
                        }
                        label={st.status}
                        dot
                      />
                      <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-300">
                        {st.rawMaterial.name} · {st.qty} units
                      </span>
                      {st.requiredBy && (
                        <span className="text-[11px] text-slate-500">
                          needed by{" "}
                          {new Date(st.requiredBy).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {st.status === "OPEN" && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAddQuote(st)}
                      >
                        Add Quote
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => closeStatement(st)}
                      >
                        Close
                      </Button>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-800/60">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800/60 text-left text-[11px] uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Supplier</th>
                        <th className="px-3 py-2">Rate/unit</th>
                        <th className="px-3 py-2">Lead (days)</th>
                        <th className="px-3 py-2">Payment</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {st.quotes.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-3 text-slate-500">
                            No quotes yet — add the first supplier rate.
                          </td>
                        </tr>
                      ) : (
                        st.quotes.map((q) => (
                          <tr
                            key={q.id}
                            className={
                              st.awardedQuoteId === q.id
                                ? "bg-emerald-500/5"
                                : ""
                            }
                          >
                            <td className="px-3 py-2 text-slate-200">
                              {q.supplier.name}
                              {st.awardedQuoteId === q.id && (
                                <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
                                  WINNER
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-300">
                              ₹{Number(q.unitRate).toLocaleString("en-IN")}
                            </td>
                            <td className="px-3 py-2 text-slate-400">
                              {q.leadDays}
                            </td>
                            <td className="px-3 py-2 text-slate-400">
                              {q.paymentTerms || "NET30"}
                            </td>
                            <td className="px-3 py-2 text-slate-200">
                              ₹
                              {(st.qty * q.unitRate).toLocaleString("en-IN", {
                                maximumFractionDigits: 0,
                              })}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {st.status === "OPEN" && (
                                <span className="inline-flex gap-1.5">
                                  <Button
                                    variant="success"
                                    size="sm"
                                    onClick={() => {
                                      setAwarding({ statement: st, quote: q });
                                      setAwardReason("");
                                    }}
                                    disabled={busy}
                                  >
                                    <Trophy className="mr-1 h-3.5 w-3.5" />{" "}
                                    Award
                                  </Button>
                                  <button
                                    onClick={() => removeQuote(st, q.id)}
                                    className="rounded-md border border-slate-700 p-1.5 text-slate-500 hover:bg-slate-800/80 hover:text-rose-400"
                                    title="Remove quote"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {createOpen && (
        <ModalPanel
          title="New Comparative Statement"
          onClose={() => setCreateOpen(false)}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Select
                label="Raw Material *"
                value={form.rawMaterialId}
                onChange={(e) =>
                  setForm({ ...form, rawMaterialId: e.target.value })
                }
              >
                <option value="">Select material…</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.sku})
                  </option>
                ))}
              </Select>
            </div>
            <Input
              label="Quantity *"
              type="number"
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
            />
            <Input
              label="Required By"
              type="date"
              value={form.requiredBy}
              onChange={(e) => setForm({ ...form, requiredBy: e.target.value })}
            />
          </div>

          <div className="mt-4">
            <div className="mb-1.5 text-xs font-medium text-slate-400">
              Supplier Quotes
            </div>
            <div className="space-y-2">
              {quoteRows.map((q, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 items-end gap-2 rounded-lg border border-slate-800/60 p-2"
                >
                  <div className="col-span-5">
                    <Select
                      label="Supplier *"
                      value={q.supplierId}
                      onChange={(e) =>
                        setQuoteRows(
                          quoteRows.map((r, j) =>
                            j === i ? { ...r, supplierId: e.target.value } : r,
                          ),
                        )
                      }
                    >
                      <option value="">Select…</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input
                      label="Rate ₹ *"
                      type="number"
                      value={q.unitRate}
                      onChange={(e) =>
                        setQuoteRows(
                          quoteRows.map((r, j) =>
                            j === i ? { ...r, unitRate: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      label="Lead (d)"
                      type="number"
                      value={q.leadDays}
                      onChange={(e) =>
                        setQuoteRows(
                          quoteRows.map((r, j) =>
                            j === i ? { ...r, leadDays: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <Select
                      label="Terms"
                      value={q.paymentTerms}
                      onChange={(e) =>
                        setQuoteRows(
                          quoteRows.map((r, j) =>
                            j === i
                              ? { ...r, paymentTerms: e.target.value }
                              : r,
                          ),
                        )
                      }
                    >
                      <option>NET30</option>
                      <option>NET45</option>
                      <option>NET60</option>
                      <option>ADVANCE</option>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={() =>
                        setQuoteRows(quoteRows.filter((_, j) => j !== i))
                      }
                      className="rounded-md border border-slate-700 p-2 text-slate-500 hover:bg-slate-800/80 hover:text-rose-400"
                      title="Remove quote"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setQuoteRows([...quoteRows, { ...EMPTY_QUOTE }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add another supplier
            </Button>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={createStatement} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}{" "}
              Create Statement
            </Button>
          </div>
        </ModalPanel>
      )}

      {awarding && "supplierId" in awarding.quote && (
        <ModalPanel
          title={`Add Quote — ${awarding.statement.statementNumber}`}
          onClose={() => setAwarding(null)}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Select
                label="Supplier *"
                value={awarding.quote.supplierId}
                onChange={(e) =>
                  setAwarding({
                    ...awarding,
                    quote: { ...awarding.quote, supplierId: e.target.value },
                  })
                }
              >
                <option value="">Select…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <Input
              label="Rate ₹ *"
              type="number"
              value={awarding.quote.unitRate}
              onChange={(e) =>
                setAwarding({
                  ...awarding,
                  quote: { ...awarding.quote, unitRate: e.target.value as any },
                })
              }
            />
            <Input
              label="Lead (days)"
              type="number"
              value={awarding.quote.leadDays}
              onChange={(e) =>
                setAwarding({
                  ...awarding,
                  quote: {
                    ...awarding.quote,
                    leadDays: Number(e.target.value),
                  },
                })
              }
            />
            <div className="col-span-2">
              <Select
                label="Payment Terms"
                value={awarding.quote.paymentTerms}
                onChange={(e) =>
                  setAwarding({
                    ...awarding,
                    quote: { ...awarding.quote, paymentTerms: e.target.value },
                  })
                }
              >
                <option>NET30</option>
                <option>NET45</option>
                <option>NET60</option>
                <option>ADVANCE</option>
              </Select>
            </div>
            <div className="col-span-2">
              <Input
                label="Notes"
                value={awarding.quote.notes}
                onChange={(e) =>
                  setAwarding({
                    ...awarding,
                    quote: { ...awarding.quote, notes: e.target.value },
                  })
                }
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAwarding(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={
                busy || !awarding.quote.supplierId || !awarding.quote.unitRate
              }
              onClick={() => {
                post({
                  action: "add_quote",
                  statementId: awarding.statement.id,
                  supplierId: awarding.quote.supplierId,
                  unitRate: String(awarding.quote.unitRate),
                  leadDays: String(awarding.quote.leadDays),
                  paymentTerms: awarding.quote.paymentTerms,
                  notes: awarding.quote.notes,
                });
                setAwarding(null);
              }}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}{" "}
              Save Quote
            </Button>
          </div>
        </ModalPanel>
      )}

      {awarding && !("supplierId" in awarding.quote) && (
        <ModalPanel
          title={`Award — ${awarding.statement.statementNumber}`}
          onClose={() => setAwarding(null)}
        >
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <Trophy className="h-5 w-5 shrink-0 text-emerald-400" />
            <div className="text-sm text-emerald-200">
              Awarding{" "}
              <span className="font-semibold">
                {awarding.quote.supplier.name}
              </span>{" "}
              @ ₹{Number(awarding.quote.unitRate).toLocaleString("en-IN")}/unit
              — this raises PO{" "}
              <span className="font-semibold">
                {awarding.statement.statementNumber}
              </span>{" "}
              for {awarding.statement.rawMaterial.name} ×{" "}
              {awarding.statement.qty} (total ₹
              {(
                awarding.statement.qty * awarding.quote.unitRate
              ).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              )
              <span className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> The PO goes through the
                approval chain automatically.
              </span>
            </div>
          </div>
          <Input
            label="Written reason *"
            value={awardReason}
            onChange={(e) => setAwardReason(e.target.value)}
            placeholder="e.g. Lowest landed rate, approved vendor"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAwarding(null)}>
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={award}
              disabled={busy || !awardReason.trim()}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}{" "}
              Award & Raise PO
            </Button>
          </div>
        </ModalPanel>
      )}
    </div>
  );
}

function ModalPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700/60 bg-slate-900/95 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
