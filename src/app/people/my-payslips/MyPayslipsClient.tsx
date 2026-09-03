"use client";

import { useEffect, useState } from "react";
import { Wallet, Printer, FileText } from "lucide-react";
import { Card, CardHeader, CardContent, Button, StatusPill } from "@/app/components/ui";
import PageHeader from "@/app/components/shared/PageHeader";

interface MySlip {
  id: string;
  month: string;
  grossPay: number;
  pfDeduction: number;
  ptDeduction: number;
  esiDeduction: number;
  lopDays: number;
  lopDeduction: number;
  bonus: number;
  arrears: number;
  otHours: number;
  otPay: number;
  netPay: number;
  salaryStructure: {
    employeeName: string;
    employeeCode: string;
    designation: string | null;
    basicPay: number;
    hra: number;
    specialAllowance: number;
    conveyance: number;
    otherAllowance: number;
    pfPercent: number;
    professionalTax: number;
  };
}

const money = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MyPayslipsClient() {
  const [slips, setSlips] = useState<MySlip[]>([]);
  const [me, setMe] = useState<{ employeeNumber: string | null; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/people/payslips")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setSlips(d.slips);
          setMe(d.me);
        } else {
          setError(d.error || "Failed to load payslips");
        }
      })
      .catch(() => setError("Failed to load payslips"))
      .finally(() => setLoading(false));
  }, []);

  const monthLabel = (m: string) => {
    const [y, mm] = m.split("-");
    return `${MONTHS[Number(mm) - 1] || mm} ${y}`;
  };

  const printSlip = (s: MySlip) => {
    const w = window.open("", "_blank", "width=760,height=900");
    if (!w) return;
    const st = s.salaryStructure;
    w.document.write(`<!doctype html><html><head><title>Payslip ${s.month} — ${st.employeeName}</title>
<style>
  body{font-family:Segoe UI,Arial,sans-serif;color:#111;margin:32px;font-size:13px}
  .head{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:16px}
  h1{font-size:18px;margin:0}
  table{width:100%;border-collapse:collapse}
  td,th{border:1px solid #999;padding:6px 8px;text-align:left}
  th{background:#eee}
  .net{font-weight:700;background:#e8f5e9}
  .right{text-align:right}
</style></head><body>
<div class="head"><div><h1>Manufacturing Max</h1><div>Pay Slip — ${monthLabel(s.month)}</div></div>
<div>Emp: <b>${st.employeeCode}</b><br/>${st.employeeName}${st.designation ? "<br/>" + st.designation : ""}</div></div>
<table>
<tr><th>Earnings</th><th class="right">₹</th><th>Deductions</th><th class="right">₹</th></tr>
<tr><td>Basic</td><td class="right">${(st.basicPay).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td><td>Provident Fund</td><td class="right">${(s.pfDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
<tr><td>HRA</td><td class="right">${(st.hra).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td><td>Professional Tax</td><td class="right">${(s.ptDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
<tr><td>Special Allowance</td><td class="right">${(st.specialAllowance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td><td>ESI (Employee)</td><td class="right">${(s.esiDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
<tr><td>Conveyance</td><td class="right">${(st.conveyance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td><td>LOP (${s.lopDays}d)</td><td class="right">${(s.lopDeduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
<tr><td>Other Allowance</td><td class="right">${(st.otherAllowance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td><td></td><td></td></tr>
<tr><td>Overtime (${s.otHours}h)</td><td class="right">${(s.otPay).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td><td></td><td></td></tr>
<tr><td>Bonus</td><td class="right">${(s.bonus).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td><td></td><td></td></tr>
<tr><td>Arrears</td><td class="right">${(s.arrears).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td><td></td><td></td></tr>
<tr class="net"><td>Gross Pay</td><td class="right">${(s.grossPay).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td><td>Net Pay</td><td class="right">${(s.netPay).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
</table>
<p style="font-size:11px;color:#555;margin-top:16px">This is a system-generated payslip from Manufacturing Max. Verify against payroll records before use.</p>
<script>window.onload=function(){window.print()}</script>
</body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Payslips"
        description={me ? `Payslips for ${me.name}${me.employeeNumber ? ` (${me.employeeNumber})` : ""} — your private salary record.` : "Your private salary record."}
        icon={<Wallet className="h-5 w-5 text-indigo-500" />}
        iconTone="indigo"
        badge={{ label: "EMPLOYEE SELF-SERVICE", tone: "new" }}
      />

      {error && (
        <Card className="border-rose-500/30">
          <CardContent>
            <p className="text-sm text-rose-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-center text-slate-400 py-10">Loading your payslips…</p>
      ) : slips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="size-8 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">
              No payslips found for your account yet.
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Payslips appear here once payroll is generated for the month matching your employee code.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {slips.map((s) => {
            const st = s.salaryStructure;
            const breakdown = [
              { label: "Basic", value: st.basicPay },
              { label: "HRA", value: st.hra },
              { label: "Special Allowance", value: st.specialAllowance },
              { label: "Conveyance", value: st.conveyance },
              { label: "Other Allowance", value: st.otherAllowance },
              { label: `Overtime (${s.otHours}h)`, value: s.otPay },
              { label: "Bonus", value: s.bonus },
              { label: "Arrears", value: s.arrears },
            ].filter((r) => r.value > 0);
            const deductions = [
              { label: "Provident Fund", value: s.pfDeduction },
              { label: "Professional Tax", value: s.ptDeduction },
              { label: "ESI (Employee)", value: s.esiDeduction },
              { label: `LOP (${s.lopDays}d)`, value: s.lopDeduction },
            ].filter((r) => r.value > 0);
            return (
              <Card key={s.id}>
                <CardHeader
                  title={monthLabel(s.month)}
                  subtitle={`${st.employeeCode} · ${st.employeeName}${st.designation ? " · " + st.designation : ""}`}
                  icon={<Wallet className="h-4 w-4" />}
                  action={
                    <Button variant="glass" size="sm" onClick={() => printSlip(s)}>
                      <Printer className="size-3.5" /> Print
                    </Button>
                  }
                />
                <CardContent className="!p-0">
                  <div className="grid grid-cols-2 gap-px bg-white/5">
                    <div className="bg-slate-900/60 px-5 py-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Earnings</p>
                      <div className="space-y-1.5">
                        {breakdown.map((r) => (
                          <div key={r.label} className="flex justify-between text-sm">
                            <span className="text-slate-300">{r.label}</span>
                            <span className="font-mono text-slate-100">{money(r.value)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-bold text-emerald-400 pt-2 border-t border-white/10">
                          <span>Gross</span>
                          <span className="font-mono">{money(s.grossPay)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-900/60 px-5 py-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Deductions</p>
                      <div className="space-y-1.5">
                        {deductions.map((r) => (
                          <div key={r.label} className="flex justify-between text-sm">
                            <span className="text-slate-300">{r.label}</span>
                            <span className="font-mono text-amber-300">{money(r.value)}</span>
                          </div>
                        ))}
                        {deductions.length === 0 && (
                          <p className="text-xs text-slate-500">No deductions</p>
                        )}
                        <div className="flex justify-between text-sm font-bold pt-2 border-t border-white/10">
                          <span className="text-white">Total Deductions</span>
                          <span className="font-mono text-amber-300">
                            {money(deductions.reduce((a, d) => a + d.value, 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4 bg-emerald-500/[0.06]">
                    <StatusPill variant="success" label="PAID NET" />
                    <span className="text-lg font-black text-emerald-400 font-mono">{money(s.netPay)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}