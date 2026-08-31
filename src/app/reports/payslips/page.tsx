import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/settings";
import PrintButton from "@/app/components/print/PrintButton";
import { Wallet, Download } from "lucide-react";
import PayslipMonthPicker from "./PayslipMonthPicker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const fmt = (v: number) => Number(v || 0).toLocaleString("en-IN");

export default async function PayslipsReport(props: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "people.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const searchParams = await props.searchParams;
  const branding = await getBranding();

  const payslips = await prisma.payslip.findMany({
    orderBy: [{ month: "desc" }, { generatedAt: "desc" }],
    include: { salaryStructure: true },
    take: 2000,
  });
  const months = Array.from(new Set(payslips.map((p) => p.month)))
    .sort()
    .reverse();
  const month =
    searchParams?.month && months.includes(searchParams.month)
      ? searchParams.month
      : months[0] || "";

  const rows = payslips.filter((p) => p.month === month);
  const totalNet = rows.reduce((s, p) => s + p.netPay, 0);
  const totalGross = rows.reduce((s, p) => s + p.grossPay, 0);
  const totalPf = rows.reduce((s, p) => s + p.pfDeduction, 0);

  const now = new Date();

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <Wallet className="w-7 h-7 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-extrabold text-white">
              Monthly Salary Payslips
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              One payslip per employee for the selected month â€” earnings,
              deductions and net pay.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/payroll/export${month ? `?month=${encodeURIComponent(month)}` : ""}`}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-200 bg-slate-800/60 border border-slate-700 rounded-xl hover:bg-slate-800/90 transition-colors shadow-sm no-print"
            title="Download payslips as CSV (Tally friendly)"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </a>
          <PrintButton />
        </div>
      </div>

      {months.length > 0 && (
        <div className="mb-6 print:hidden flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-600 text-slate-300">
            Month
          </label>
          <PayslipMonthPicker months={months} current={month} />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700 p-10 text-center text-slate-400">
          No payslips yet. Generate a month in{" "}
          <a href="/people/payroll" className="text-blue-400 underline">
            Payroll & Salary
          </a>
          .
        </div>
      ) : (
        <div className="space-y-6">
          {rows.map((p) => {
            const s = p.salaryStructure;
            const earnings = [
              { label: "Basic Pay", value: s.basicPay },
              { label: "House Rent Allowance", value: s.hra },
              { label: "Special Allowance", value: s.specialAllowance },
              { label: "Conveyance", value: s.conveyance },
              { label: "Other Allowance", value: s.otherAllowance },
            ].filter((e) => Number(e.value) > 0);
            const earningsTotal = earnings.reduce(
              (sum, e) => sum + Number(e.value),
              0,
            );
            return (
              <div
                key={p.id}
                className="bg-slate-800/60 rounded-2xl border-2 border-slate-600 shadow-sm overflow-hidden print:border-gray-400 print:break-inside-avoid"
              >
                {/* Payslip header */}
                <div className="px-6 py-4 border-b-2 border-slate-600 print:border-gray-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-800/60 print:bg-gray-50">
                  <div>
                    <div className="text-lg font-black text-white">
                      {branding.companyName || "Manufacturing Max"}
                    </div>
                    <div className="text-[11px] text-slate-400 print:text-gray-600">
                      Salary Payslip Â· {p.month} Â· Generated{" "}
                      {now.toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400 print:text-gray-600">
                    <div>
                      Employee:{" "}
                      <strong className="text-white print:text-black">
                        {s.employeeName}
                      </strong>
                    </div>
                    <div>
                      Code: {s.employeeCode} Â· {s.designation || "â€”"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 divide-slate-700 print:divide-gray-300">
                  {/* Earnings */}
                  <div className="p-5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 mb-2">
                      Earnings
                    </h3>
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200">
                        {earnings.map((e) => (
                          <tr key={e.label}>
                            <td className="py-1.5 text-slate-600 text-slate-300 print:text-gray-700">
                              {e.label}
                            </td>
                            <td className="py-1.5 text-right font-mono text-white print:text-black">
                              {fmt(e.value)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-slate-600 print:border-gray-300">
                          <td className="py-2 font-black text-white print:text-black">
                            Gross Pay
                          </td>
                          <td className="py-2 text-right font-mono font-black text-emerald-400 print:text-black">
                            {fmt(earningsTotal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {/* Deductions */}
                  <div className="p-5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-rose-500 mb-2">
                      Deductions
                    </h3>
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200">
                        <tr>
                          <td className="py-1.5 text-slate-600 text-slate-300 print:text-gray-700">
                            Provident Fund
                          </td>
                          <td className="py-1.5 text-right font-mono text-white print:text-black">
                            {fmt(p.pfDeduction)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-1.5 text-slate-600 text-slate-300 print:text-gray-700">
                            Professional Tax
                          </td>
                          <td className="py-1.5 text-right font-mono text-white print:text-black">
                            {fmt(p.ptDeduction)}
                          </td>
                        </tr>
                        <tr className="border-t-2 border-slate-600 print:border-gray-300">
                          <td className="py-2 font-black text-white print:text-black">
                            Net Pay
                          </td>
                          <td className="py-2 text-right font-mono font-black text-emerald-400 print:text-black">
                            {fmt(p.netPay)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-600 print:border-gray-300 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400 print:text-gray-500">
                    Amount payable: â‚¹ {fmt(p.netPay)} Â· This is a
                    system-generated payslip.
                  </div>
                  <div className="flex gap-10">
                    <div className="text-center">
                      <div className="border-t-2 border-dotted border-slate-500 pt-1.5 text-[10px] font-semibold text-slate-400 print:text-gray-600">
                        Employee Signature
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="border-t-2 border-dotted border-slate-500 pt-1.5 text-[10px] font-semibold text-slate-400 print:text-gray-600">
                        Authorized Signatory
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="bg-slate-800/60 rounded-2xl border border-slate-700 p-5 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm print:border-gray-300">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
                Employees
              </div>
              <div className="text-xl font-black text-white">{rows.length}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
                Gross Payroll
              </div>
              <div className="text-xl font-black text-white">
                â‚¹ {fmt(totalGross)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
                PF Deductions
              </div>
              <div className="text-xl font-black text-white">
                â‚¹ {fmt(totalPf)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-black text-slate-400">
                Net Payroll
              </div>
              <div className="text-xl font-black text-emerald-400">
                â‚¹ {fmt(totalNet)}
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 print:text-gray-400">
            Manufacturing MAX Â· Monthly Salary Payslips Â· {month} Â·{" "}
            {branding.companyName} Â· Confidential
          </p>
        </div>
      )}
    </main>
  );
}
