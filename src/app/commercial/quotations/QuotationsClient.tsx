"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import Link from "next/link";
import TallyExportButtons from "@/app/components/TallyExportButtons";
import {
  FileText,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  X,
  Loader2,
  Printer,
  Sparkles,
  Search,
  Package,
  Wrench,
} from "lucide-react";
import PrintButton from "@/app/components/print/PrintButton";

interface Product {
  id: string;
  sku: string;
  name: string;
  materialCostPerUnit?: number;
  sellingPricePerUnit?: number;
  targetCycleTimeSeconds: number;
}

interface QuotationLine {
  id?: string;
  productId: string;
  product?: Product;
  plannedQty: number;
  unitPrice: number;
  subtotal: number;
}

interface Quotation {
  id: string;
  quoteNumber: string;
  customerName: string;
  customerContact?: string;
  status: "DRAFT" | "SENT" | "WON" | "LOST" | "CONVERTED";
  validUntil?: string;
  estimatedCost: number;
  quotedPrice: number;
  marginPct: number;
  notes?: string;
  workOrderId?: string;
  workOrder?: any;
  createdAt: string;
  lines: QuotationLine[];
  wonReason?: string | null;
  discountPct: number;
  discountApprovalStatus?: string;
  discountApprovedBy?: string | null;
  discountRejectReason?: string | null;
}

export default function QuotationsClient({
  products,
  branding,
}: {
  products: Product[];
  branding?: any;
  laborRatePerHour: number;
  machineRatePerHour: number;
}) {
  const [activeSection, setActiveSection] = useState<"QUOTATIONS" | "INVOICES">(
    "QUOTATIONS",
  );
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // M15 — discount approval decisions
  const [discountDecision, setDiscountDecision] = useState<{
    quote: Quotation;
    approve: boolean;
  } | null>(null);
  const [discountReason, setDiscountReason] = useState("");

  // New Quotation Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [globalQuotedPrice, setGlobalQuotedPrice] = useState<string>("");
  // P5 — engineering estimation feed: per-line { idx -> estimate }
  const [estimates, setEstimates] = useState<Record<number, any>>({});
  const [pullLoading, setPullLoading] = useState<number | null>(null);

  const [quoteLines, setQuoteLines] = useState<
    { productId: string; plannedQty: number; unitPrice: number }[]
  >([{ productId: products[0]?.id || "", plannedQty: 100, unitPrice: 0 }]);

  // Real-time estimating state
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateData, setEstimateData] = useState<any>(null);

  // Detail / Print Modal State
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Conversion loading
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    type: "ok" | "err";
  } | null>(null);

  // Payment Modal State
  const [payInvoice, setPayInvoice] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentMethod, setPaymentMethod] = useState<string>("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/quotations");
      if (res.ok) {
        const json = await res.json();
        setQuotations(json.quotations || []);
      }
    } catch (err) {
      logClientError("Failed to load quotations:", err, "QuotationsClient");
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/invoices");
      if (res.ok) {
        const json = await res.json();
        setInvoices(json.invoices || []);
      }
    } catch (err) {
      logClientError("Failed to load invoices:", err, "QuotationsClient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
    fetchInvoices();
  }, []);

  // Real-time cost estimation recalculation
  useEffect(() => {
    if (!showNewModal || quoteLines.length === 0) return;

    const timeout = setTimeout(async () => {
      try {
        setEstimateLoading(true);
        const validLines = quoteLines.filter(
          (l) => l.productId && l.plannedQty > 0,
        );
        if (validLines.length === 0) {
          setEstimateData(null);
          return;
        }

        const priceNum = globalQuotedPrice
          ? parseFloat(globalQuotedPrice)
          : undefined;
        const res = await fetch("/api/quotations/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines: validLines, quotedPrice: priceNum }),
        });

        if (res.ok) {
          const json = await res.json();
          setEstimateData(json.estimate);
        }
      } catch (err) {
        logClientError("Estimating failed:", err, "QuotationsClient");
      } finally {
        setEstimateLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [showNewModal, quoteLines, globalQuotedPrice]);

  const handleAddLine = () => {
    const nextProd =
      products[quoteLines.length % products.length] || products[0];
    setQuoteLines([
      ...quoteLines,
      { productId: nextProd?.id || "", plannedQty: 100, unitPrice: 0 },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (quoteLines.length === 1) return;
    setQuoteLines(quoteLines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: string, val: any) => {
    const updated = [...quoteLines];
    updated[index] = { ...updated[index], [field]: val };
    setQuoteLines(updated);
  };

  // P5 — pull the engineering estimation sheet into the quotation line:
  // cycle times + tooling cost → suggested unit price.
  const pullEstimate = async (index: number) => {
    const line = quoteLines[index];
    if (!line?.productId) return;
    setPullLoading(index);
    try {
      const res = await fetch(
        `/api/estimation?productId=${line.productId}&qty=${Math.max(1, Number(line.plannedQty) || 1)}`,
      );
      if (res.ok) {
        const d = await res.json();
        setEstimates((prev) => ({ ...prev, [index]: d }));
        handleLineChange(index, "unitPrice", d.suggestedUnitPrice);
        showToast(
          `Estimate pulled — ₹${d.suggestedUnitPrice}/unit (labour ₹${d.cost.labourCostPerUnit} + material ₹${d.cost.materialCostPerUnit} + tooling ₹${d.cost.toolingPerUnit})`,
          "ok",
        );
      } else {
        showToast("Estimation failed", "err");
      }
    } catch {
      showToast("Network error pulling estimate", "err");
    } finally {
      setPullLoading(null);
    }
  };

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || quoteLines.length === 0) {
      showToast("Please provide customer name and line items", "err");
      return;
    }

    try {
      setLoading(true);
      const priceNum = globalQuotedPrice
        ? parseFloat(globalQuotedPrice)
        : undefined;
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerContact,
          validUntil,
          notes,
          lines: quoteLines,
          quotedPrice: priceNum,
        }),
      });

      if (res.ok) {
        showToast("Quotation created successfully!");
        setShowNewModal(false);
        setCustomerName("");
        setCustomerContact("");
        setNotes("");
        setGlobalQuotedPrice("");
        fetchQuotations();
      } else {
        const errJson = await res.json();
        showToast(errJson.error || "Failed to create quotation", "err");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create quotation", "err");
    } finally {
      setLoading(false);
    }
  };

  const handleConvertQuote = async (quote: Quotation) => {
    try {
      setConvertingId(quote.id);
      const res = await fetch(`/api/quotations/${quote.id}/convert`, {
        method: "POST",
      });
      if (res.ok) {
        const json = await res.json();
        showToast(
          `Converted! Work Order ${json.workOrders?.[0]?.woNumber || ""} created.`,
        );
        fetchQuotations();
      } else {
        const errJson = await res.json();
        showToast(errJson.error || "Conversion failed", "err");
      }
    } catch (err: any) {
      showToast(err.message || "Conversion failed", "err");
    } finally {
      setConvertingId(null);
    }
  };

  const handleRecordPayment = async () => {
    if (!payInvoice || !paymentAmount) return;
    try {
      setPaymentLoading(true);
      const res = await fetch(`/api/invoices/${payInvoice.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          paymentDate,
          method: paymentMethod,
          reference: paymentReference,
          notes: paymentNotes,
        }),
      });
      if (res.ok) {
        fetchInvoices();
        setPayInvoice(null);
        showToast("Payment recorded successfully", "ok");
      } else {
        showToast("Failed to record payment", "err");
      }
    } catch (err) {
      showToast("Error recording payment", "err");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleUpdateStatus = async (quoteId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/quotations/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast(`Status updated to ${newStatus}`);
        fetchQuotations();
      } else {
        showToast(json?.error || "Update failed", "err");
      }
    } catch (err) {
      logClientError(err, "QuotationsClient");
    }
  };

  const decideDiscount = async (
    q: Quotation,
    approve: boolean,
    reason: string,
  ) => {
    try {
      const res = await fetch(`/api/quotations/${q.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          approve
            ? { action: "approve-discount" }
            : { action: "reject-discount", reason },
        ),
      });
      const json = await res.json();
      if (res.ok) {
        showToast(
          approve
            ? `Discount approved on ${q.quoteNumber}`
            : `Discount rejected on ${q.quoteNumber}`,
        );
        setDiscountDecision(null);
        fetchQuotations();
      } else {
        showToast(json?.error || "Decision failed", "err");
      }
    } catch (err) {
      logClientError(err, "QuotationsClient");
    }
  };

  const filteredQuotes = quotations.filter((q) => {
    const matchesStatus = statusFilter === "ALL" || q.status === statusFilter;
    const matchesSearch =
      q.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
      q.customerName.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8">
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl text-sm font-bold text-white flex items-center gap-2 animate-bounce ${
            toast.type === "ok" ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {toast.type === "ok" ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          {toast.msg}
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/30">
              <FileText className="w-7 h-7" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Sales Front Door &amp; Quotations
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                BOM-backed smart cost estimating, margin protection, and 1-click
                shopfloor conversion.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setShowNewModal(true);
            setEstimateData(null);
          }}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Create New Quotation
        </button>
      </div>

      {/* SECTION TABS */}
      <div className="max-w-7xl mx-auto flex border-b border-slate-700 space-x-8">
        <button
          onClick={() => setActiveSection("QUOTATIONS")}
          className={`pb-3 text-sm font-extrabold flex items-center gap-2 transition-all border-b-2 ${
            activeSection === "QUOTATIONS"
              ? "border-blue-600 text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-900 hover:text-white"
          }`}
        >
          <FileText className="w-4 h-4" /> Quotations &amp; Estimating (
          {quotations.length})
        </button>
        <button
          onClick={() => setActiveSection("INVOICES")}
          className={`pb-3 text-sm font-extrabold flex items-center gap-2 transition-all border-b-2 ${
            activeSection === "INVOICES"
              ? "border-emerald-600 text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-900 hover:text-white"
          }`}
        >
          <FileText className="w-4 h-4" /> GST Tax Invoices ({invoices.length})
        </button>
      </div>

      {/* SUMMARY KPI CARDS */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Total Quotations
          </span>
          <span className="text-2xl font-black font-mono text-white mt-1 block">
            {quotations.length}
          </span>
        </div>

        <div className="p-5 bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Won Bids Value
          </span>
          <span className="text-2xl font-black font-mono text-emerald-400 mt-1 block">
            â‚¹
            {quotations
              .filter((q) => q.status === "WON" || q.status === "CONVERTED")
              .reduce((sum, q) => sum + q.quotedPrice, 0)
              .toLocaleString("en-IN")}
          </span>
        </div>

        <div className="p-5 bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Average Quote Margin %
          </span>
          <span className="text-2xl font-black font-mono text-blue-400 mt-1 block">
            {(
              quotations.reduce((sum, q) => sum + (q.marginPct || 0), 0) /
              (quotations.length || 1)
            ).toFixed(1)}
            %
          </span>
        </div>

        <div className="p-5 bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Conversions to Work Orders
          </span>
          <span className="text-2xl font-black font-mono text-purple-400 mt-1 block">
            {quotations.filter((q) => q.status === "CONVERTED").length} /{" "}
            {quotations.length}
          </span>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search quote # or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/60 border border-slate-700 text-white rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {["ALL", "DRAFT", "SENT", "WON", "CONVERTED", "LOST"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === st
                  ? "bg-slate-500/15 text-slate-100 shadow-sm"
                  : "bg-slate-800/60 text-slate-400 border border-slate-700 hover:bg-slate-50"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {activeSection === "QUOTATIONS" ? (
        /* QUOTATIONS TABLE */
        <div className="max-w-7xl mx-auto bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Quote Number</th>
                  <th className="py-3.5 px-4 font-bold">Customer</th>
                  <th className="py-3.5 px-4 font-bold">Estimated Cost</th>
                  <th className="py-3.5 px-4 font-bold">Quoted Value</th>
                  <th className="py-3.5 px-4 font-bold">Margin %</th>
                  <th className="py-3.5 px-4 font-bold">Valid Until</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 divide-slate-800">
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-slate-400"
                    >
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading sales quotations...
                    </td>
                  </tr>
                ) : filteredQuotes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-slate-400 italic"
                    >
                      No quotations found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredQuotes.map((q) => {
                    const isLoss = q.marginPct < 0;
                    const isHighMargin = q.marginPct >= 20;

                    return (
                      <tr
                        key={q.id}
                        className="hover:bg-slate-50/60 hover:bg-slate-800/90/40 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                          {q.quoteNumber}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white">
                          {q.customerName}
                          {q.customerContact && (
                            <span className="block text-xs font-normal text-slate-400 font-mono">
                              {q.customerContact}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 text-slate-300">
                          â‚¹{q.estimatedCost.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          â‚¹{q.quotedPrice.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-extrabold border ${
                              isLoss
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse"
                                : isHighMargin
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-950 text-amber-300 border-amber-300 dark:border-amber-800"
                            }`}
                          >
                            {isLoss ? (
                              <TrendingDown className="w-3.5 h-3.5" />
                            ) : (
                              <TrendingUp className="w-3.5 h-3.5" />
                            )}
                            {q.marginPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono text-slate-500">
                          {q.validUntil
                            ? new Date(q.validUntil).toLocaleDateString()
                            : "â€”"}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${
                              q.status === "CONVERTED"
                                ? "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/80 text-purple-300 dark:border-purple-800"
                                : q.status === "WON"
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/80 text-emerald-300 dark:border-emerald-800"
                                  : q.status === "SENT"
                                    ? "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/80 text-blue-300 dark:border-blue-800"
                                    : q.status === "DRAFT"
                                      ? "bg-slate-800/60 text-slate-300 border-slate-600"
                                      : "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/80 text-rose-300 dark:border-rose-800"
                            }`}
                          >
                            {q.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {q.discountPct > 0 && (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-extrabold border ${
                                q.discountApprovalStatus === "PENDING_MANAGER"
                                  ? "bg-amber-500/10 text-amber-300 border-amber-500/40 animate-pulse"
                                  : q.discountApprovalStatus === "REJECTED"
                                    ? "bg-rose-500/10 text-rose-300 border-rose-500/40"
                                    : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                              }`}
                              title={
                                q.discountApprovalStatus === "PENDING_MANAGER"
                                  ? "Discount above 5% — awaiting a manager"
                                  : q.discountApprovalStatus === "REJECTED"
                                    ? `Discount rejected — ${q.discountRejectReason || ""}`
                                    : q.discountApprovedBy
                                      ? `Approved by ${q.discountApprovedBy}`
                                      : "Within approval limit"
                              }
                            >
                              −{q.discountPct.toFixed(1)}%
                              {q.discountApprovalStatus === "PENDING_MANAGER"
                                ? " PENDING"
                                : q.discountApprovalStatus === "REJECTED"
                                  ? " REJECTED"
                                  : " APPROVED"}
                            </span>
                          )}
                          {q.discountApprovalStatus === "PENDING_MANAGER" && (
                            <span className="mt-1 flex gap-1">
                              <button
                                onClick={() => {
                                  setDiscountDecision({
                                    quote: q,
                                    approve: true,
                                  });
                                  setDiscountReason("");
                                }}
                                className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/40 rounded-md text-[10px] font-bold hover:bg-emerald-500/20 transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setDiscountDecision({
                                    quote: q,
                                    approve: false,
                                  });
                                  setDiscountReason("");
                                }}
                                className="px-1.5 py-0.5 bg-rose-500/10 text-rose-300 border border-rose-500/40 rounded-md text-[10px] font-bold hover:bg-rose-500/20 transition-colors"
                              >
                                Reject
                              </button>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          {/* Status Toggle Buttons */}
                          {q.status === "DRAFT" && (
                            <button
                              onClick={() => handleUpdateStatus(q.id, "SENT")}
                              className="px-2.5 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950 text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                            >
                              Mark Sent
                            </button>
                          )}

                          {(q.status === "SENT" || q.status === "DRAFT") && (
                            <button
                              onClick={() => handleUpdateStatus(q.id, "WON")}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                            >
                              Mark Won
                            </button>
                          )}

                          {/* 1-CLICK CONVERSION BUTTON */}
                          {q.status === "WON" && (
                            <button
                              onClick={() => handleConvertQuote(q)}
                              disabled={convertingId === q.id}
                              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 inline-flex cursor-pointer"
                            >
                              {convertingId === q.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                              )}
                              Convert to WO ðŸš€
                            </button>
                          )}

                          {q.status === "CONVERTED" && q.workOrderId && (
                            <Link
                              href={`/ops/work-orders/${q.workOrderId}`}
                              className="px-2.5 py-1 bg-purple-50 text-purple-700 dark:bg-purple-950 text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg text-xs font-bold hover:bg-purple-100 transition-colors inline-flex items-center gap-1"
                            >
                              View WO <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}

                          {/* Print / View Modal */}
                          <button
                            onClick={() => {
                              setSelectedQuote(q);
                              setShowPrintModal(true);
                            }}
                            className="px-2.5 py-1 bg-slate-800/60 text-slate-300 border border-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors inline-flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" /> Print Quote
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GST TAX INVOICES TABLE */
        <div className="max-w-7xl mx-auto bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-500" />
              GST Tax Invoice Ledger
            </h2>
            <TallyExportButtons types={["INVOICES"]} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Invoice Number</th>
                  <th className="py-3.5 px-4 font-bold">Customer Name</th>
                  <th className="py-3.5 px-4 font-bold">Invoice Date</th>
                  <th className="py-3.5 px-4 font-bold">Taxable Value</th>
                  <th className="py-3.5 px-4 font-bold">
                    GST Tax (CGST+SGST / IGST)
                  </th>
                  <th className="py-3.5 px-4 font-bold">Total Invoice Value</th>
                  <th className="py-3.5 px-4 font-bold">Due Date</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 divide-slate-800">
                {invoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-12 text-center text-slate-400 italic"
                    >
                      No GST Tax Invoices generated yet.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv: any) => {
                    const totalTax = inv.cgstAmt + inv.sgstAmt + inv.igstAmt;
                    const isPaid = inv.status === "PAID";
                    const isPartial = inv.status === "PARTIAL";

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50/60 hover:bg-slate-800/90/40 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-purple-400">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white">
                          {inv.customerName}
                          {inv.customerGstin && (
                            <span className="block text-xs font-normal text-slate-400 font-mono">
                              GSTIN: {inv.customerGstin}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                          {new Date(inv.invoiceDate).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          â‚¹{inv.taxableValue.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-emerald-400">
                          â‚¹{totalTax.toLocaleString("en-IN")}{" "}
                          <span className="text-[10px] text-slate-400 font-sans">
                            ({inv.taxType} {inv.taxRatePct}%)
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-extrabold text-white text-base">
                          â‚¹{inv.totalValue.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                          {inv.dueDate
                            ? new Date(inv.dueDate).toLocaleDateString()
                            : "â€”"}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                              isPaid
                                ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/80 text-emerald-300 dark:border-emerald-800"
                                : isPartial
                                  ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/80 text-amber-300 dark:border-amber-800"
                                  : "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/80 text-rose-300 dark:border-rose-800 animate-pulse"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          {!isPaid && (
                            <button
                              onClick={() => {
                                setPayInvoice(inv);
                                setPaymentAmount(
                                  (
                                    inv.totalValue - (inv.paidAmount || 0)
                                  ).toString(),
                                );
                                setPaymentDate(
                                  new Date().toISOString().slice(0, 10),
                                );
                                setPaymentMethod("BANK_TRANSFER");
                                setPaymentReference("");
                                setPaymentNotes("");
                              }}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                            >
                              <DollarSign className="w-3.5 h-3.5 inline mr-1" />
                              Record Payment
                            </button>
                          )}
                          <Link
                            href={`/reports/invoice/${inv.id}`}
                            className="px-3 py-1.5 bg-purple-50 text-purple-700 dark:bg-purple-950 text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg text-xs font-bold hover:bg-purple-100 transition-colors inline-flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" /> View / Print Tax
                            Invoice
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* â”€â”€ NEW QUOTATION & SMART ESTIMATING MODAL â”€â”€ */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-800/60 border border-slate-700 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-white">
                    New Quotation &amp; Smart Cost Estimating
                  </h3>
                  <p className="text-xs text-slate-400">
                    Live BOM component lookup + labor/machine rate calculations.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:text-slate-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={handleCreateQuotation}
              className="space-y-6 text-sm"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-300 text-xs uppercase tracking-wider mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Titan Automotive Pvt Ltd"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 text-xs uppercase tracking-wider mb-1">
                    Customer Contact / Email
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. procurement@titanauto.com"
                    value={customerContact}
                    onChange={(e) => setCustomerContact(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 text-xs uppercase tracking-wider mb-1">
                    Valid Until Date
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 text-xs uppercase tracking-wider mb-1">
                    Notes / Terms
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Agreed payment terms NET-30"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* LINE ITEMS SPECIFICATION */}
              <div className="space-y-3 pt-2 border-t border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-500" />
                    Quotation Line Items ({quoteLines.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950 text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Line Item
                  </button>
                </div>

                <div className="space-y-3">
                  {quoteLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center p-3 bg-slate-800/60 border border-slate-600 rounded-xl"
                    >
                      <div className="col-span-5">
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                          Product / SKU
                        </label>
                        <select
                          value={line.productId}
                          onChange={(e) =>
                            handleLineChange(idx, "productId", e.target.value)
                          }
                          className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                          Planned Qty
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={line.plannedQty}
                          onChange={(e) =>
                            handleLineChange(
                              idx,
                              "plannedQty",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>

                      <div className="col-span-3">
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                          Unit Price (â‚¹)
                        </label>
                        <input
                          type="number"
                          placeholder="Auto BOM"
                          value={line.unitPrice || ""}
                          onChange={(e) =>
                            handleLineChange(
                              idx,
                              "unitPrice",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-full bg-slate-800/60 border border-slate-600 text-white rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>

                      <div className="col-span-1 text-right pt-4 flex flex-col items-end gap-1">
                        <button
                          type="button"
                          onClick={() => pullEstimate(idx)}
                          disabled={pullLoading === idx || !line.productId}
                          title="Pull engineering estimate (cycle time + tooling cost)"
                          className="inline-flex items-center gap-1 text-[10px] font-bold rounded-lg bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 px-1.5 py-1 hover:bg-indigo-500/25 disabled:opacity-40 transition-colors"
                        >
                          {pullLoading === idx ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Wrench className="w-3 h-3" />
                          )}
                          Estimate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {estimates[idx] && (
                        <div className="col-span-12 rounded-lg bg-slate-900/60 border border-indigo-500/20 px-3 py-2 text-[11px] text-slate-400">
                          <span className="text-indigo-300 font-semibold">
                            Engineering estimate:
                          </span>{" "}
                          {estimates[idx].operations.length} ops ·{" "}
                          {estimates[idx].totals.cycleSecondsTotal}s cycle ·
                          labour ₹{estimates[idx].cost.labourCostPerUnit} ·
                          material ₹{estimates[idx].cost.materialCostPerUnit} ·
                          tooling ₹{estimates[idx].cost.toolingPerUnit}/unit ·{" "}
                          <span className="text-emerald-300 font-semibold">
                            suggested ₹{estimates[idx].suggestedUnitPrice}
                          </span>{" "}
                          (incl. {estimates[idx].marginPct}% margin)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* REAL-TIME ESTIMATING ENGINE BOX */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 text-white">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    Smart Estimating Engine Calculation
                  </span>
                  {estimateLoading && (
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  )}
                </div>

                {estimateData ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px] uppercase font-sans">
                          Estimated Cost (BOM + Rates)
                        </span>
                        <span className="text-lg font-black text-white mt-0.5 block">
                          â‚¹
                          {estimateData.estimatedCost?.toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px] uppercase font-sans">
                          Quoted Price Total
                        </span>
                        <input
                          type="number"
                          placeholder={`â‚¹${estimateData.quotedPrice}`}
                          value={globalQuotedPrice}
                          onChange={(e) => setGlobalQuotedPrice(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 text-white font-black text-sm rounded px-2 py-1 mt-0.5 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-400"
                        />
                      </div>

                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px] uppercase font-sans">
                          Projected Net Profit
                        </span>
                        <span
                          className={`text-lg font-black mt-0.5 block ${
                            estimateData.profit >= 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          â‚¹{estimateData.profit?.toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px] uppercase font-sans">
                          Margin %
                        </span>
                        <span
                          className={`text-lg font-black mt-0.5 block ${
                            estimateData.marginPct >= 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {estimateData.marginPct?.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* MASSIVE RED WARNING IF BIDDING AT A LOSS */}
                    {estimateData.isLoss && (
                      <div className="p-4 bg-rose-950/90 border-2 border-rose-600 rounded-xl flex items-center justify-between text-rose-200 animate-pulse">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-7 h-7 text-rose-400 shrink-0" />
                          <div>
                            <strong className="text-base font-black tracking-wide block">
                              ðŸš¨ BIDDING AT A LOSS!
                            </strong>
                            <span className="text-xs">
                              Quoted price â‚¹{estimateData.quotedPrice} is
                              below the estimated cost â‚¹
                              {estimateData.estimatedCost}. Projected loss: -â‚¹
                              {Math.abs(estimateData.profit)}.
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Add valid line items above to generate real-time cost
                    estimates...
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-800/90 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Quotation (DRAFT)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* â”€â”€ PRINT PROFORMA INVOICE / QUOTE MODAL â”€â”€ */}
      {showPrintModal && selectedQuote && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl max-w-4xl w-full p-8 shadow-2xl space-y-6 my-8 print:p-0 print:shadow-none print:bg-transparent">
            {/* NO-PRINT HEADER BAR */}
            <div className="flex items-center justify-between border-b pb-4 print:hidden">
              <span className="font-extrabold text-sm text-slate-600 flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                Proforma Invoice Preview â€” {selectedQuote.quoteNumber}
              </span>
              <div className="flex items-center gap-3">
                <PrintButton />
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>

            {/* PRINTABLE PROFORMA LAYOUT */}
            <div className="space-y-6 p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl print:border-none print:p-0">
              {/* COMPANY BRANDING HEADER */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">
                    {branding?.companyName || "Apex Manufacturing Ltd"}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Enterprise Manufacturing Execution Systems &amp; Precision
                    Components
                  </p>
                  <p className="text-xs text-slate-500">
                    100 Industrial Parkway, Plant Complex 1
                  </p>
                </div>
                <div className="text-right font-mono">
                  <span className="px-3 py-1 bg-blue-500/10 text-blue-300 font-extrabold text-sm rounded-lg border border-blue-400/20 block">
                    PROFORMA INVOICE
                  </span>
                  <span className="text-lg font-black text-slate-900 block mt-2">
                    {selectedQuote.quoteNumber}
                  </span>
                  <span className="text-xs text-slate-500 block">
                    Date:{" "}
                    {new Date(selectedQuote.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* CUSTOMER & VALIDITY DETAILS */}
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-medium">
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px] mb-1">
                    Billed To (Customer):
                  </span>
                  <strong className="text-slate-900 text-sm block">
                    {selectedQuote.customerName}
                  </strong>
                  <span className="text-slate-600 block mt-0.5">
                    {selectedQuote.customerContact || "Direct Procurement Desk"}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px] mb-1">
                    Quotation Terms:
                  </span>
                  <span className="block text-slate-700">
                    Status: <strong>{selectedQuote.status}</strong>
                  </span>
                  <span className="block text-slate-700 mt-0.5">
                    Valid Until:{" "}
                    <strong>
                      {selectedQuote.validUntil
                        ? new Date(
                            selectedQuote.validUntil,
                          ).toLocaleDateString()
                        : "15 days from issue"}
                    </strong>
                  </span>
                </div>
              </div>

              {/* LINE ITEMS BREAKDOWN */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-600 font-bold uppercase tracking-wider">
                      <th className="p-3">#</th>
                      <th className="p-3">Product Description / SKU</th>
                      <th className="p-3 text-right">Quantity</th>
                      <th className="p-3 text-right">Unit Price (â‚¹)</th>
                      <th className="p-3 text-right">Subtotal (â‚¹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {selectedQuote.lines.map((l, idx) => (
                      <tr key={l.id || idx}>
                        <td className="p-3 text-slate-500 font-sans">
                          {idx + 1}
                        </td>
                        <td className="p-3 font-sans">
                          <strong className="text-slate-900 block">
                            {l.product?.name}
                          </strong>
                          <span className="text-[11px] text-slate-500 font-mono">
                            SKU: {l.product?.sku}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          {l.plannedQty.toLocaleString()} pcs
                        </td>
                        <td className="p-3 text-right text-slate-700">
                          â‚¹{l.unitPrice?.toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          â‚¹{l.subtotal?.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* TOTALS & TERMS */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t border-slate-200">
                <div className="text-xs text-slate-500 space-y-1 max-w-md">
                  <strong className="text-slate-900 block font-bold">
                    Terms &amp; Conditions:
                  </strong>
                  <p>1. Prices are valid until the specified expiry date.</p>
                  <p>
                    2. Subject to raw material market index variance exceeding
                    $\pm 5\%$.
                  </p>
                  <p>
                    3. Standard payment terms NET-30 days from dispatch delivery
                    challan.
                  </p>
                  {selectedQuote.notes && (
                    <p className="italic text-slate-700 pt-1">
                      Notes: {selectedQuote.notes}
                    </p>
                  )}
                </div>

                <div className="w-full sm:w-64 bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-xs space-y-2 text-right">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>
                      â‚¹{selectedQuote.quotedPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Applicable Tax (GST 18%):</span>
                    <span>Included</span>
                  </div>
                  <div className="flex justify-between font-black text-sm text-slate-900 border-t border-slate-300 pt-2">
                    <span>Total Order Value:</span>
                    <span className="text-blue-600">
                      â‚¹{selectedQuote.quotedPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* AUTHORIZED SIGNATURE FOOTER */}
              <div className="pt-12 flex items-center justify-between text-xs text-slate-500 font-sans border-t border-slate-200">
                <div>
                  <p className="font-bold text-slate-900">
                    Customer Acceptance Sign-off
                  </p>
                  <div className="mt-8 w-48 border-b border-slate-400" />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Signature &amp; Stamp
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">
                    Authorized Plant Sales Manager
                  </p>
                  <div className="mt-8 w-48 border-b border-slate-400 ml-auto" />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Apex Manufacturing Execution System
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* RECORD PAYMENT MODAL */}
      {payInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-slate-800/60 w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-700">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/60">
              <h2 className="font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Record Payment
              </h2>
              <button
                onClick={() => setPayInvoice(null)}
                className="p-1 hover:bg-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-600 space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Invoice Total:</span>
                  <span className="font-bold text-white font-mono">
                    â‚¹{payInvoice.totalValue.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Already Paid:</span>
                  <span className="font-bold text-emerald-600 font-mono">
                    â‚¹{(payInvoice.paidAmount || 0).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold text-white pt-2 border-t border-slate-600">
                  <span>Remaining Due:</span>
                  <span className="font-mono text-rose-600">
                    â‚¹
                    {(
                      payInvoice.totalValue - (payInvoice.paidAmount || 0)
                    ).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Payment Amount (â‚¹) *
                  </label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Method *
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="BANK_TRANSFER">
                        Bank Transfer (NEFT/RTGS)
                      </option>
                      <option value="UPI">UPI</option>
                      <option value="CASH">Cash</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Reference / UTR Number
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. HDFCR52026110912"
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Any additional notes"
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-end gap-3 bg-slate-800/60">
              <button
                onClick={() => setPayInvoice(null)}
                className="px-4 py-2 text-sm font-bold text-slate-400 hover:bg-slate-200 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={paymentLoading || !paymentAmount}
                className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                {paymentLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* M15 — Discount approval decision modal */}
      {discountDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
              <div>
                <h3 className="text-lg font-extrabold text-white">
                  {discountDecision.approve
                    ? "Approve discount"
                    : "Reject discount"}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {discountDecision.quote.quoteNumber} ·{" "}
                  {discountDecision.quote.customerName} · −
                  {discountDecision.quote.discountPct.toFixed(1)}% on ₹
                  {discountDecision.quote.quotedPrice.toLocaleString("en-IN")}
                </p>
              </div>
              <button
                onClick={() => setDiscountDecision(null)}
                className="text-slate-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
            {!discountDecision.approve && (
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Rejection reason *
                  </label>
                  <textarea
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="e.g. Margin erodes below floor — renegotiate"
                    className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono h-20"
                  />
                </div>
              </div>
            )}
            <div className="p-4 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setDiscountDecision(null)}
                className="px-4 py-2 text-sm font-bold text-slate-400 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  decideDiscount(
                    discountDecision.quote,
                    discountDecision.approve,
                    discountReason,
                  )
                }
                disabled={!discountDecision.approve && !discountReason.trim()}
                className={`px-4 py-2 text-sm font-bold text-white rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 ${
                  discountDecision.approve
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {discountDecision.approve
                  ? "Approve Discount"
                  : "Reject Discount"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
