"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Ban,
  Trash2,
  FileText,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";
import { Card, CardHeader, CardContent, Button, Input, Select, StatusPill } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";

interface CustomerRef {
  id: string;
  code: string;
  name: string;
  currency: string;
  isActive: boolean;
}
interface SoLine {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxPct: number;
  amount: number;
  discountAmt: number;
  taxAmt: number;
  total: number;
}
interface SalesOrder {
  id: string;
  orderNumber: string;
  customer: CustomerRef;
  customerName: string;
  orderDate: string;
  expectedDelivery: string | null;
  poReference: string | null;
  status: string;
  currency: string;
  grandTotal: number;
  notes: string | null;
  lines: SoLine[];
}

interface DraftLine {
  key: number;
  productId: string;
  productName: string;
  quantity: string;
  unitPrice: string;
  taxPct: string;
}

const fmt = (n: number, cur = "INR") =>
  (cur === "USD" ? "$" : "₹") + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const STATUS_VARIANT: Record<string, any> = {
  DRAFT: "draft",
  CONFIRMED: "success",
  IN_PRODUCTION: "in_progress",
  PARTIALLY_DISPATCHED: "running",
  DISPATCHED: "active",
  INVOICED: "completed",
  CANCELLED: "danger",
};

export default function SalesOrdersClient() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, invoiced: 0, bookedValue: 0 });
  const [customers, setCustomers] = useState<CustomerRef[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [quotationId, setQuotationId] = useState("");
  const [poReference, setPoReference] = useState("");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { key: 1, productId: "", productName: "", quantity: "", unitPrice: "", taxPct: "0" },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalOpen) {
        setModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen]);

  const load = () => {
    Promise.all([
      fetch("/api/commercial/sales-orders").then((r) => r.json()),
      fetch("/api/commercial/customers").then((r) => r.json()),
      fetch("/api/quotations").then((r) => r.json()),
    ])
      .then(([o, c, q]) => {
        if (o.success) {
          setOrders(o.orders);
          setStats(o.stats);
        }
        if (c.success) {
          setCustomers(c.customers.filter((x: any) => x.isActive));
        }
        if (q.quotations) setQuotes(q.quotations);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const pickQuotation = (qid: string) => {
    setQuotationId(qid);
    const q = quotes.find((x) => x.id === qid);
    if (!q) return;
    const rows: DraftLine[] = (q.lines || []).map((l: any, i: number) => ({
      key: Date.now() + i,
      productId: l.product?.id || "",
      productName: l.product?.name || `Product ${l.productId}`,
      quantity: String(l.plannedQty),
      unitPrice: String(l.unitPrice),
      taxPct: "0",
    }));
    setLines(rows);
    const cust = customers.find((c) => c.name === q.customerName);
    if (cust) setCustomerId(cust.id);
  };

  const updateLine = (key: number, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const totals = useMemo(() => {
    let value = 0;
    let tax = 0;
    for (const l of lines) {
      const amt = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
      value += amt;
      tax += (amt * (Number(l.taxPct) || 0)) / 100;
    }
    return { value, tax, total: value + tax };
  }, [lines]);

  const createOrder = async () => {
    if (!customerId) {
      toast.error("Select a customer");
      return;
    }
    const cleanLines = lines
      .filter((l) => l.productName.trim() && (Number(l.quantity) || 0) > 0)
      .map((l) => ({
        productId: l.productId || undefined,
        productName: l.productName.trim(),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice) || 0,
        taxPct: Number(l.taxPct) || 0,
      }));
    if (cleanLines.length === 0) {
      toast.error("Add at least one line with a quantity");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/commercial/sales-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          quotationId: quotationId || undefined,
          expectedDelivery: expectedDelivery || null,
          poReference: poReference || null,
          notes: notes || null,
          lines: cleanLines,
          clientId: `so-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        toast.error(d.error || "Failed to create order");
        return;
      }
      soundFx.playSuccess();
      toast.success(`${d.order.orderNumber} created (${d.order.grandTotal.toFixed(2)} ${d.order.currency})`);
      setModalOpen(false);
      setLines([{ key: Date.now(), productId: "", productName: "", quantity: "", unitPrice: "", taxPct: "0" }]);
      setQuotationId("");
      setPoReference("");
      setNotes("");
      setCustomerId("");
      load();
    } catch {
      toast.error("Failed to create order");
    } finally {
      setSaving(false);
    }
  };

  const act = async (o: SalesOrder, action: "confirm" | "cancel") => {
    if (action === "cancel" && !window.confirm(`Cancel ${o.orderNumber}?`)) return;
    setBusyId(o.id);
    try {
      const res = await fetch(`/api/commercial/sales-orders/${o.id}`, {
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
      toast.success(`${o.orderNumber} ${action === "confirm" ? "confirmed" : "cancelled"}`);
      load();
    } catch {
      toast.error("Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const bill = async (o: SalesOrder) => {
    if (
      !window.confirm(
        `Raise an invoice for the open lines of ${o.orderNumber}?`,
      )
    )
      return;
    setBusyId(o.id);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesOrderId: o.id }),
      });
      const d = await res.json();
      if (!res.ok || !d.invoice) {
        // Self-heal notice: order was already fully invoiced and is now INVOICED
        if (res.ok && (d.healed || d.nothingToBill) && d.message) {
          toast.success(d.message);
          load();
          return;
        }
        toast.error(d.error || "Invoicing failed");
        return;
      }
      soundFx.playSuccess();
      toast.success(
        `Invoice ${d.invoice.invoiceNumber} raised — ₹${(
          d.invoice.totalValue || 0
        ).toLocaleString("en-IN")} · ${d.lineItems ?? 0} line item(s)`,
      );
      load();
    } catch {
      toast.error("Invoicing failed");
    } finally {
      setBusyId(null);
    }
  };

  const lineQtyTotal = (o: SalesOrder) => o.lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Orders"
        description="Booked order book with line items — create from a quotation or freeform, confirm into the pipeline, and track value."
        icon={<ClipboardList className="h-5 w-5 text-sky-500" />}
        iconTone="blue"
        badge={{ label: "ORDER BOOK", tone: "new" }}
      >
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus className="size-4" /> New Sales Order
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Total Orders</p>
          <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Open (Confirmed)</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{stats.open}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Invoiced</p>
          <p className="text-2xl font-black text-sky-400 mt-1">{stats.invoiced}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-slate-400 font-medium">Booked Value (Open)</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{fmt(stats.bookedValue)}</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Order Book"
          subtitle={`${orders.length} orders · newest first`}
          icon={<ClipboardList className="h-4 w-4" />}
        />
        <CardContent className="!p-0">
          <div className="max-h-[640px] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-10 text-center text-slate-400">Loading sales orders…</p>
            ) : orders.length === 0 ? (
              <p className="px-4 py-10 text-center text-slate-400">
                No sales orders yet — book your first order.
              </p>
            ) : (
              orders.map((o) => (
                <div key={o.id} className="border-b border-white/5">
                  <div className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.03]">
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                    >
                      <div className="flex items-center gap-2">
                        {expanded === o.id ? (
                          <ChevronUp className="size-4 text-slate-500 shrink-0" />
                        ) : (
                          <ChevronDown className="size-4 text-slate-500 shrink-0" />
                        )}
                        <p className="font-mono text-sm text-white">{o.orderNumber}</p>
                        <StatusPill variant={STATUS_VARIANT[o.status] || "neutral"} label={o.status.replace(/_/g, " ")} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {o.customer?.name || o.customerName}
                        {o.poReference ? ` · PO ${o.poReference}` : ""}
                        {o.expectedDelivery ? ` · due ${new Date(o.expectedDelivery).toLocaleDateString("en-IN")}` : ""}
                        {o.lines.length ? ` · ${o.lines.length} line(s), ${lineQtyTotal(o)} qty` : ""}
                      </p>
                    </button>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-sm font-bold text-slate-100">
                        {fmt(o.grandTotal, o.currency)}
                      </span>
                      {o.status === "DRAFT" && (
                        <>
                          <Button variant="success" size="sm" isLoading={busyId === o.id} onClick={() => act(o, "confirm")}>
                            <CheckCircle2 className="size-3.5" /> Confirm
                          </Button>
                          <Button variant="ghost" size="sm" isLoading={busyId === o.id} onClick={() => act(o, "cancel")}>
                            <Ban className="size-3.5" />
                          </Button>
                        </>
                      )}
                      {["CONFIRMED", "IN_PRODUCTION", "PARTIALLY_DISPATCHED", "DISPATCHED"].includes(
                        o.status,
                      ) && o.lines.length > 0 && (
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={busyId === o.id}
                          onClick={() => bill(o)}
                        >
                          <FileText className="size-3.5" /> Bill
                        </Button>
                      )}
                      {o.status !== "CANCELLED" && o.status !== "DRAFT" && o.status !== "INVOICED" && (
                        <Button variant="ghost" size="sm" onClick={() => act(o, "cancel")}>
                          <Ban className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {expanded === o.id && (
                    <div className="px-4 pb-4 pl-12">
                      <div className="overflow-x-auto rounded-xl border border-white/5">
                        <table className="w-full text-xs">
                          <thead className="bg-white/[0.03]">
                            <tr className="text-left uppercase tracking-wider text-slate-500">
                              <th className="px-3 py-2 font-semibold">Item</th>
                              <th className="px-3 py-2 font-semibold text-right">Qty</th>
                              <th className="px-3 py-2 font-semibold text-right">Rate</th>
                              <th className="px-3 py-2 font-semibold text-right">Disc</th>
                              <th className="px-3 py-2 font-semibold text-right">Tax</th>
                              <th className="px-3 py-2 font-semibold text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {o.lines.map((l) => (
                              <tr key={l.id} className="border-t border-white/5">
                                <td className="px-3 py-2 text-slate-200">{l.productName}</td>
                                <td className="px-3 py-2 text-right font-mono text-slate-300">{l.quantity}</td>
                                <td className="px-3 py-2 text-right font-mono text-slate-300">{fmt(l.unitPrice, o.currency)}</td>
                                <td className="px-3 py-2 text-right font-mono text-slate-400">{l.discountPct ? l.discountPct + "%" : "—"}</td>
                                <td className="px-3 py-2 text-right font-mono text-slate-400">{l.taxPct ? l.taxPct + "%" : "—"}</td>
                                <td className="px-3 py-2 text-right font-mono text-slate-100">{fmt(l.total, o.currency)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {o.notes && <p className="text-xs text-slate-500 mt-2">{o.notes}</p>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sales-order-modal-title"
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h3 id="sales-order-modal-title" className="font-semibold text-white">New Sales Order</h3>
                <p className="text-xs text-slate-400">Book the order — draft until confirmed</p>
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Select label="Customer *" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Select customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                  ))}
                </Select>
                <Select
                  label="Copy from Quotation (optional)"
                  value={quotationId}
                  onChange={(e) => pickQuotation(e.target.value)}
                >
                  <option value="">— none —</option>
                  {quotes.map((q: any) => (
                    <option key={q.id} value={q.id}>
                      {q.quoteNumber} · {q.customerName} · {q.lines?.length || 0} lines
                    </option>
                  ))}
                </Select>
                <Input label="Customer PO Reference" value={poReference} onChange={(e) => setPoReference(e.target.value)} placeholder="PO-12345" />
                <Input label="Expected Delivery" type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lines</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setLines((ls) => [...ls, { key: Date.now(), productId: "", productName: "", quantity: "", unitPrice: "", taxPct: "0" }])
                  }
                >
                  <Plus className="size-3.5" /> Add line
                </Button>
              </div>
              <div className="space-y-2">
                {lines.map((l) => (
                  <div key={l.key} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      className="col-span-5 !py-2 text-xs"
                      placeholder="Item description"
                      value={l.productName}
                      onChange={(e) => updateLine(l.key, { productName: e.target.value })}
                    />
                    <Input
                      className="col-span-2 !py-2 text-xs"
                      type="number"
                      min="0"
                      placeholder="Qty"
                      value={l.quantity}
                      onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                    />
                    <Input
                      className="col-span-2 !py-2 text-xs"
                      type="number"
                      min="0"
                      placeholder="Rate"
                      value={l.unitPrice}
                      onChange={(e) => updateLine(l.key, { unitPrice: e.target.value })}
                    />
                    <Input
                      className="col-span-2 !py-2 text-xs"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="GST %"
                      value={l.taxPct}
                      onChange={(e) => updateLine(l.key, { taxPct: e.target.value })}
                    />
                    <button
                      onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}
                      className="col-span-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="size-4 mx-auto" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/10 px-4 py-2.5 text-sm">
                <span className="text-slate-400">Line value</span>
                <span className="font-mono text-slate-200">{fmt(totals.value)}</span>
                <span className="text-slate-400">Tax</span>
                <span className="font-mono text-slate-200">{fmt(totals.tax)}</span>
                <span className="text-slate-200 font-bold">Grand total</span>
                <span className="font-mono text-emerald-400 font-bold">{fmt(totals.total)}</span>
              </div>

              <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery terms, special instructions…" />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="success" onClick={createOrder} isLoading={saving}>
                <FileText className="size-4" /> Create Draft Order
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}