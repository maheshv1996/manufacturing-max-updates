"use client";

import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  IndianRupee,
  Activity,
} from "lucide-react";
import { format } from "date-fns";

export default function VaultClient({
  totalValuation,
  lowStockItems,
  inwardToday,
  outwardToday,
  recentTransactions,
}: any) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-1 rounded-card border border-border p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-text-2 text-sm font-medium">
              Total Valuation
            </span>
            <IndianRupee className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold">
              ₹{totalValuation.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-surface-1 rounded-card border border-border p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-text-2 text-sm font-medium">Low Stock</span>
            <AlertTriangle className="h-5 w-5 text-orange-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-orange-500">
              {lowStockItems.length}
            </span>
            <span className="text-text-3 text-xs ml-2">items</span>
          </div>
        </div>

        <div className="bg-surface-1 rounded-card border border-border p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-text-2 text-sm font-medium">
              Inward Today
            </span>
            <ArrowDownToLine className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold">{inwardToday}</span>
            <span className="text-text-3 text-xs ml-2">transactions</span>
          </div>
        </div>

        <div className="bg-surface-1 rounded-card border border-border p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-text-2 text-sm font-medium">
              Outward Today
            </span>
            <ArrowUpFromLine className="h-5 w-5 text-purple-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold">{outwardToday}</span>
            <span className="text-text-3 text-xs ml-2">transactions</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <button className="bg-[var(--color-accent)] hover:opacity-90 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
          <ArrowDownToLine className="h-4 w-4" /> Receive Stock
        </button>
        <button className="bg-surface-2 hover:bg-surface-3 text-text-1 border border-border px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
          <ArrowUpFromLine className="h-4 w-4" /> Issue to Job
        </button>
        <button className="bg-surface-2 hover:bg-surface-3 text-text-1 border border-border px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
          <Package className="h-4 w-4" /> New PO
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Low Stock List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-bold text-text-1 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" /> Low Stock
            Alerts
          </h2>
          <div className="space-y-3">
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-text-3">No low stock items.</p>
            ) : (
              lowStockItems.map((item: any) => (
                <div
                  key={item.id}
                  className="bg-surface-1 border border-orange-500/30 rounded-card p-4 flex flex-col gap-2"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-text-1">{item.name}</span>
                    <span className="text-xs text-text-3">{item.sku}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-sm">
                      <span className="text-orange-500 font-bold">
                        {item.currentStock}
                      </span>
                      <span className="text-text-3 ml-1">{item.unit}</span>
                    </div>
                    <div className="text-xs text-text-2">
                      Min: {item.minStock} {item.unit}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Col: Live Feed */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-text-1 flex items-center gap-2">
            <Activity className="h-5 w-5" /> Live Stock Movement
          </h2>
          <div className="bg-surface-1 border border-border rounded-card overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2 border-b border-border text-xs uppercase text-text-3 font-semibold">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-4 text-center text-sm text-text-3"
                    >
                      No recent transactions.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((tx: any) => {
                    const isTxIn = tx.type === "IN";
                    const isTxOut = tx.type === "OUT";
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-surface-2/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-text-2">
                          {format(new Date(tx.at), "MMM d, HH:mm")}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-text-1">
                          {tx.rawMaterial?.name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              isTxIn
                                ? "bg-blue-500/10 text-blue-500"
                                : isTxOut
                                  ? "bg-purple-500/10 text-purple-500"
                                  : "bg-orange-500/10 text-orange-500"
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3 text-sm text-right font-medium ${
                            isTxIn
                              ? "text-blue-500"
                              : isTxOut
                                ? "text-purple-500"
                                : "text-text-1"
                          }`}
                        >
                          {isTxIn ? "+" : isTxOut ? "-" : ""}
                          {tx.qty}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-2">
                          {tx.reference || tx.workOrder?.orderNumber || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-2">
                          {tx.actorName}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
