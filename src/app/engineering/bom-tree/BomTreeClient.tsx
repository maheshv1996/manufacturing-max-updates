"use client";

import { useState, useEffect } from "react";
import {
  FolderTree,
  Plus,
  Cpu,
  Package,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Tag,
  Boxes,
  X,
  FileSpreadsheet,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface BomLineItem {
  id: string;
  rawMaterialId: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  qtyPerUnit: number;
  costPerUnit: number;
  totalLineCost: number;
  currentStock: number;
  minStock: number;
}

interface RoutingStepItem {
  id: string;
  seq: number;
  stationName: string;
  operationName: string;
  machineCode: string;
  machineName: string;
  setupTimeMin: number;
  cycleTimeMin: number;
  isHoldPoint: boolean;
}

interface ProductTree {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  unit: string;
  materialCost: number;
  machiningCost: number;
  toolingCost: number;
  totalStandardCost: number;
  suggestedSellingPrice: number;
  bomLines: BomLineItem[];
  routingSteps: RoutingStepItem[];
}

export default function BomTreeClient() {
  const [products, setProducts] = useState<ProductTree[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [_loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    materials: true,
    routing: true,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRmId, setSelectedRmId] = useState("");
  const [qtyPerUnitInput, setQtyPerUnitInput] = useState("1");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/engineering/bom-tree");
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setRawMaterials(data.rawMaterials || []);
        if (!selectedProductId && data.products?.length > 0) {
          setSelectedProductId(data.products[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load BOM tree", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddBomLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !selectedRmId || !qtyPerUnitInput) return;

    setSaving(true);
    try {
      const res = await fetch("/api/engineering/bom-tree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          rawMaterialId: selectedRmId,
          qtyPerUnit: parseFloat(qtyPerUnitInput),
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setSelectedRmId("");
        setQtyPerUnitInput("1");
        await fetchData();
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to add BOM line");
      }
    } catch (err) {
      console.error("Add BOM error", err);
    } finally {
      setSaving(false);
    }
  };

  const selectedProduct =
    products.find((p) => p.id === selectedProductId) || products[0];

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const exportBomCsv = () => {
    if (!selectedProduct) return;
    const rows = [
      [
        "Type",
        "Code/SKU",
        "Name",
        "Qty",
        "UOM",
        "Unit Cost (Rs)",
        "Total Cost (Rs)",
      ],
      [
        "Top Assembly",
        selectedProduct.sku,
        selectedProduct.name,
        "1",
        selectedProduct.unit,
        "-",
        "-",
      ],
      ...selectedProduct.bomLines.map((b) => [
        "Material Component",
        b.code,
        b.name,
        b.qtyPerUnit.toString(),
        b.unit,
        b.costPerUnit.toString(),
        b.totalLineCost.toString(),
      ]),
      ...selectedProduct.routingSteps.map((s) => [
        "Routing Operation",
        s.machineCode,
        `${s.operationName} (${s.stationName})`,
        `${s.cycleTimeMin} min`,
        "Cycle",
        "Rs 20/min",
        (s.cycleTimeMin * 20).toFixed(2),
      ]),
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BOM_Tree_${selectedProduct.sku}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Multi-Level BOM Tree & Cost Exploder"
        description="Nested assembly hierarchies, raw material explosion, operation routing, and live standard cost rollups."
      >
        <div className="flex items-center gap-3">
          <button
            onClick={exportBomCsv}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 text-xs font-semibold transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Export CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Component
          </button>
        </div>
      </PageHeader>

      {/* Product Selector Bar */}
      <div className="bg-surface-1 border border-border rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-3 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-2xl">
            <FolderTree className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-text-3 block">
              Active Manufactured Assembly
            </span>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="mt-1 w-full max-w-md bg-surface-2 border border-border rounded-xl px-3.5 py-2 font-bold text-text-1 text-sm focus:outline-none focus:border-accent"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedProduct && (
          <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-border pt-3 md:pt-0 md:pl-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-text-3">
                Total Standard Cost
              </span>
              <div className="text-2xl font-black font-mono text-cyan-400">
                ₹{selectedProduct.totalStandardCost.toFixed(2)}
              </div>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-text-3">
                Target Sell Price
              </span>
              <div className="text-2xl font-black font-mono text-emerald-400">
                ₹{selectedProduct.suggestedSellingPrice.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedProduct && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Visual Tree Hierarchy (8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            {/* Top Assembly Root Node */}
            <div className="bg-gradient-to-r from-blue-950/40 via-surface-1 to-surface-1 border-2 border-blue-500/40 rounded-3xl p-6 shadow-md relative">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-600/30">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-bold uppercase tracking-wider font-mono">
                      Level 0 (Finished Assembly)
                    </span>
                    <h2 className="text-xl font-extrabold text-text-1 mt-1">
                      {selectedProduct.name}
                    </h2>
                    <div className="text-xs text-text-3 font-mono mt-0.5">
                      SKU: {selectedProduct.sku} · UOM: {selectedProduct.unit}
                    </div>
                  </div>
                </div>

                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-bold rounded-full">
                  Rollup: ₹{selectedProduct.totalStandardCost.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Tree Branch: Material Components (Level 1) */}
            <div className="bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-3">
              <button
                onClick={() => toggleSection("materials")}
                className="w-full flex items-center justify-between text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  {expandedSections.materials ? (
                    <ChevronDown className="w-4 h-4 text-text-3 group-hover:text-text-1" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-3 group-hover:text-text-1" />
                  )}
                  <h3 className="font-extrabold text-sm text-text-1 flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-amber-400" />
                    Bill of Materials Breakdown (
                    {selectedProduct.bomLines.length} components)
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400">
                  Subtotal: ₹{selectedProduct.materialCost.toFixed(2)}
                </span>
              </button>

              {expandedSections.materials && (
                <div className="pl-6 border-l-2 border-amber-500/20 space-y-2 mt-3">
                  {selectedProduct.bomLines.length === 0 ? (
                    <div className="py-4 text-xs text-text-3 italic">
                      No raw materials defined in BOM. Click "+ Add Component"
                      above.
                    </div>
                  ) : (
                    selectedProduct.bomLines.map((line) => (
                      <div
                        key={line.id}
                        className="p-3.5 rounded-2xl bg-surface-2 border border-border flex items-center justify-between gap-3 hover:border-amber-500/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Tag className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-xs text-text-1 flex items-center gap-2">
                              <span>{line.name}</span>
                              <span className="font-mono text-[10px] text-text-3">
                                ({line.code})
                              </span>
                            </div>
                            <div className="text-[11px] text-text-3 mt-0.5">
                              Qty:{" "}
                              <span className="font-mono font-bold text-text-2">
                                {line.qtyPerUnit} {line.unit}
                              </span>{" "}
                              · Cost:{" "}
                              <span className="font-mono">
                                ₹{line.costPerUnit}/{line.unit}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono font-extrabold text-xs text-amber-400">
                            ₹{line.totalLineCost.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-text-3">
                            Stock:{" "}
                            <span
                              className={
                                line.currentStock < line.minStock
                                  ? "text-rose-400 font-bold"
                                  : "text-emerald-400"
                              }
                            >
                              {line.currentStock} {line.unit}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Tree Branch: Operations & Routing Sequence (Level 1) */}
            <div className="bg-surface-1 border border-border rounded-3xl p-5 shadow-sm space-y-3">
              <button
                onClick={() => toggleSection("routing")}
                className="w-full flex items-center justify-between text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  {expandedSections.routing ? (
                    <ChevronDown className="w-4 h-4 text-text-3 group-hover:text-text-1" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-3 group-hover:text-text-1" />
                  )}
                  <h3 className="font-extrabold text-sm text-text-1 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    Manufacturing Routing & Workstation Operations (
                    {selectedProduct.routingSteps.length} steps)
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  Subtotal: ₹{selectedProduct.machiningCost.toFixed(2)}
                </span>
              </button>

              {expandedSections.routing && (
                <div className="pl-6 border-l-2 border-cyan-500/20 space-y-2 mt-3">
                  {selectedProduct.routingSteps.length === 0 ? (
                    <div className="py-4 text-xs text-text-3 italic">
                      No routing steps defined for this assembly.
                    </div>
                  ) : (
                    selectedProduct.routingSteps.map((step) => (
                      <div
                        key={step.id}
                        className="p-3.5 rounded-2xl bg-surface-2 border border-border flex items-center justify-between gap-3 hover:border-cyan-500/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-black text-xs flex items-center justify-center border border-cyan-500/30">
                            {step.seq}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-text-1 flex items-center gap-2">
                              <span>{step.operationName}</span>
                              {step.isHoldPoint && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-rose-500/20 text-rose-300 font-bold rounded">
                                  Hold Point
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-text-3 mt-0.5">
                              Station:{" "}
                              <span className="font-semibold text-text-2">
                                {step.stationName}
                              </span>{" "}
                              ({step.machineCode})
                            </div>
                          </div>
                        </div>

                        <div className="text-right font-mono text-xs">
                          <div className="font-bold text-text-1">
                            {step.cycleTimeMin} min / unit
                          </div>
                          <div className="text-[10px] text-text-3">
                            Setup: {step.setupTimeMin}m
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Cost Rollup Summary & Economics (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="font-extrabold text-text-1 text-sm flex items-center gap-2 border-b border-border pb-3">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Cost Rollup Architecture
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-text-3">Raw Materials</span>
                  <span className="font-mono font-bold text-text-1">
                    ₹{selectedProduct.materialCost.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-text-3">Machining & Operations</span>
                  <span className="font-mono font-bold text-text-1">
                    ₹{selectedProduct.machiningCost.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-text-3">
                    Tooling & Engineering Amortization
                  </span>
                  <span className="font-mono font-bold text-text-1">
                    ₹{selectedProduct.toolingCost.toFixed(2)}
                  </span>
                </div>

                <div className="pt-2 flex justify-between items-center text-sm font-extrabold text-cyan-400">
                  <span>Total Unit Standard Cost</span>
                  <span className="font-mono text-base">
                    ₹{selectedProduct.totalStandardCost.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs font-bold text-emerald-400 pt-1">
                  <span>Suggested Selling Price</span>
                  <span className="font-mono">
                    ₹{selectedProduct.suggestedSellingPrice.toFixed(2)}
                  </span>
                </div>

                <div className="bg-surface-2 rounded-xl p-3 mt-3 text-[11px] text-text-3 space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>Target Margin:</span>
                    <span className="text-emerald-400 font-bold">
                      ~35.0% Gross Margin
                    </span>
                  </div>
                  <div>
                    Standard pricing incorporates raw material batch scrap and
                    multi-step CNC machining overhead.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Component Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-extrabold text-text-1 text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-accent" />
                Add Component to BOM
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-surface-3 text-text-3 hover:text-text-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBomLine} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1.5">
                  Select Raw Material / Fastener
                </label>
                <select
                  value={selectedRmId}
                  onChange={(e) => setSelectedRmId(e.target.value)}
                  required
                  className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-1 font-semibold focus:outline-none focus:border-accent"
                >
                  <option value="">-- Choose Raw Material --</option>
                  {rawMaterials.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      {rm.code} — {rm.name} ({rm.unit || "kg"}) - ₹
                      {rm.costPerUnit || 100}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-3 mb-1.5">
                  Quantity per Assembly Unit
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.001"
                  value={qtyPerUnitInput}
                  onChange={(e) => setQtyPerUnitInput(e.target.value)}
                  required
                  className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-text-1 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-2 font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !selectedRmId}
                  className="w-1/2 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs shadow-md transition-colors disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Save to BOM"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
