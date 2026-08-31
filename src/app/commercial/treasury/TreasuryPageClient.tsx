"use client";

import { useState } from "react";
import DynamicRegister from "@/app/components/shared/DynamicRegister";
import BankReconcileClient from "./BankReconcileClient";
import BudgetVarianceBanner from "./BudgetVarianceBanner";
import { PiggyBank, Wallet, Landmark } from "lucide-react";

export default function TreasuryPageClient() {
  const [tab, setTab] = useState<"treasury" | "budget" | "reconcile">(
    "treasury",
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTab("treasury")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            tab === "treasury"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-800/60 text-slate-300 hover:bg-slate-200 hover:bg-slate-700 border border-slate-600"
          }`}
        >
          <Wallet className="w-4 h-4" /> Treasury
        </button>
        <button
          onClick={() => setTab("budget")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            tab === "budget"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-800/60 text-slate-300 hover:bg-slate-200 hover:bg-slate-700 border border-slate-600"
          }`}
        >
          <PiggyBank className="w-4 h-4" /> Budget
        </button>
        <button
          onClick={() => setTab("reconcile")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            tab === "reconcile"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-800/60 text-slate-300 hover:bg-slate-200 hover:bg-slate-700 border border-slate-600"
          }`}
        >
          <Landmark className="w-4 h-4" /> Reconcile
        </button>
      </div>

      {tab === "treasury" && (
        <DynamicRegister
          config={{
            title: "Treasury Transactions",
            description:
              "Cash inflows / outflows across accounts with references.",
            entity: "treasuryTransactions",
            icon: Wallet,
            accent: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
            fields: [
              { key: "date", label: "Date", type: "date" },
              {
                key: "type",
                label: "Type",
                type: "select",
                options: ["INFLOW", "OUTFLOW"],
              },
              { key: "account", label: "Account", placeholder: "e.g. Main" },
              {
                key: "amount",
                label: "Amount (â‚¹)",
                type: "number",
                required: true,
              },
              {
                key: "reference",
                label: "Reference",
                placeholder: "e.g. UTR / Cheque no.",
              },
              {
                key: "category",
                label: "Category",
                placeholder: "e.g. Customer Payment",
              },
              { key: "notes", label: "Notes", type: "textarea" },
            ],
            columns: [
              { key: "date", label: "Date", format: "date" },
              { key: "type", label: "Type" },
              { key: "account", label: "Account" },
              { key: "amount", label: "Amount", format: "currency" },
              { key: "reference", label: "Reference" },
              { key: "category", label: "Category" },
            ],
            searchKeys: ["reference", "category", "account"],
          }}
        />
      )}

      {tab === "reconcile" && <BankReconcileClient />}

      {tab === "budget" && (
        <>
          <BudgetVarianceBanner />
          <DynamicRegister
            config={{
              title: "Departmental Budget",
              description:
                "Allocated vs spent per department and cost category per fiscal year.",
              entity: "budgetLines",
              icon: PiggyBank,
              accent: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
              fields: [
                {
                  key: "fiscalYear",
                  label: "Fiscal Year",
                  required: true,
                  placeholder: "e.g. FY26",
                },
                { key: "department", label: "Department", required: true },
                {
                  key: "category",
                  label: "Category",
                  required: true,
                  placeholder: "e.g. Capex",
                },
                { key: "allocated", label: "Allocated (â‚¹)", type: "number" },
                { key: "spent", label: "Spent (â‚¹)", type: "number" },
                { key: "notes", label: "Notes", type: "textarea" },
              ],
              columns: [
                { key: "fiscalYear", label: "FY" },
                { key: "department", label: "Department" },
                { key: "category", label: "Category" },
                { key: "allocated", label: "Allocated", format: "currency" },
                { key: "spent", label: "Spent", format: "currency" },
              ],
              searchKeys: ["fiscalYear", "department", "category"],
            }}
          />
        </>
      )}
    </div>
  );
}
