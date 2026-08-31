"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Landmark,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";

interface BankInstrument {
  id: string;
  type: string;
  typeName: string;
  customerOrBeneficiary: string;
  issuingBank: string;
  amount: number;
  currency: string;
  marginMoneyPercent: number;
  issuedDate: string;
  expiryDate: string;
  claimPeriodEndDate: string;
  status: string;
  linkedContract: string;
}

export default function BankingClient() {
  const [instruments, setInstruments] = useState<BankInstrument[]>([]);

  // New Form
  const [type, setType] = useState("PERFORMANCE_BG");
  const [customer, setCustomer] = useState("");
  const [bank, setBank] = useState("State Bank of India");
  const [amount, setAmount] = useState(1000000);
  const [currency, setCurrency] = useState("INR");
  const [expiryDate, setExpiryDate] = useState("");
  const [linkedContract, setLinkedContract] = useState("");

  useEffect(() => {
    fetch("/api/finance/banking")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setInstruments(data.instruments);
      })
      .catch(() => {});
  }, []);

  const totalExposureInr = instruments.reduce((sum, item) => {
    return sum + (item.currency === "USD" ? item.amount * 86 : item.amount);
  }, 0);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !expiryDate) {
      toast.error("Please enter beneficiary customer and expiry date");
      return;
    }

    const newInst: BankInstrument = {
      id: (type === "EXPORT_LC" ? "LC-2026-" : "BG-2026-") + Math.floor(1000 + Math.random() * 9000),
      type,
      typeName: type === "PERFORMANCE_BG" ? "Performance Bank Guarantee (PBG)" : type === "ADVANCE_BG" ? "Advance Payment Bank Guarantee (ABG)" : "Irrevocable Export Letter of Credit (LC)",
      customerOrBeneficiary: customer,
      issuingBank: bank,
      amount: Number(amount),
      currency,
      marginMoneyPercent: 10,
      issuedDate: new Date().toISOString().split("T")[0],
      expiryDate,
      claimPeriodEndDate: expiryDate,
      status: "ACTIVE",
      linkedContract: linkedContract || "CONTRACT-" + Math.floor(100 + Math.random() * 900),
    };

    setInstruments([newInst, ...instruments]);
    soundFx.playSuccess();
    toast.success("Bank instrument recorded successfully!");
    setCustomer("");
    setLinkedContract("");
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-blue-950/40 border border-emerald-500/20 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold border border-emerald-500/30">
              TREASURY & BANKING GUARANTEES
            </span>
            <span className="text-xs text-white/50 font-mono">PBG // ABG // EXPORT LCs</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Bank Guarantees & Letters of Credit Expiry Radar
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Real-time tracking of active Performance Guarantees (PBG), Advance Mobilization BGs (ABG), and Export Letters of Credit. Automated countdown prevents inadvertent claim invocation.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-black/40 border border-emerald-500/30 text-right font-mono">
          <div className="text-[10px] text-white/50 uppercase font-bold">Total Active Exposure</div>
          <div className="text-2xl font-black text-emerald-400">
            ₹{(totalExposureInr / 100000).toFixed(2)} Lakhs
          </div>
        </div>
      </div>

      {/* Grid of Active Instruments */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {instruments.map((inst) => {
          const daysLeft = Math.ceil((new Date(inst.expiryDate).getTime() - Date.now()) / (1000 * 86400));
          const isExpiring = daysLeft <= 30;

          return (
            <div
              key={inst.id}
              className={`p-5 rounded-3xl border transition-all space-y-4 ${
                isExpiring
                  ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20"
                  : "bg-white/[0.02] border-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-black text-cyan-300">{inst.id}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                    isExpiring
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  }`}
                >
                  {daysLeft > 0 ? `${daysLeft} Days to Expiry` : "EXPIRED"}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-extrabold text-white">{inst.customerOrBeneficiary}</h3>
                <p className="text-xs text-white/60 font-mono">{inst.typeName}</p>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/10 font-mono space-y-1 text-xs">
                <div className="flex justify-between text-white/70">
                  <span>Sanctioned Value:</span>
                  <span className="text-emerald-400 font-bold">
                    {inst.currency} {inst.amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-white/70">
                  <span>Issuing Bank:</span>
                  <span className="text-white font-bold">{inst.issuingBank.split("(")[0]}</span>
                </div>
                <div className="flex justify-between text-white/70">
                  <span>Contract / PO:</span>
                  <span className="text-cyan-300">{inst.linkedContract}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-white/50 pt-1">
                <span>Expiry: {inst.expiryDate}</span>
                <span>Margin: {inst.marginMoneyPercent}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Form to Log New Bank Instrument */}
      <form onSubmit={handleCreate} className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <Plus className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-mono font-bold text-white uppercase">Issue / Record New Bank Guarantee or Export LC</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-mono text-white/60 block mb-1">Instrument Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
            >
              <option value="PERFORMANCE_BG">Performance Bank Guarantee (PBG)</option>
              <option value="ADVANCE_BG">Advance Payment BG (ABG)</option>
              <option value="FINANCIAL_BG">Financial / Security Deposit BG</option>
              <option value="EXPORT_LC">Export Letter of Credit (LC)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono text-white/60 block mb-1">Beneficiary Customer / Client *</label>
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="E.g. Bharat Dynamics Ltd / ISRO"
              className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono text-white/60 block mb-1">Issuing / Confirming Bank</label>
            <input
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="State Bank of India"
              className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono text-white/60 block mb-1">Guaranteed Amount *</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono text-white/60 block mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono text-white/60 block mb-1">Expiry Date *</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-2"
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Record Bank Instrument</span>
          </button>
        </div>
      </form>
    </div>
  );
}
