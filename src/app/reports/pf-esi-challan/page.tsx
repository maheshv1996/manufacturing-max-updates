import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { getBranding } from "@/lib/settings";
import { BadgeIndianRupee } from "lucide-react";
import ChallanMonthPicker from "./ChallanMonthPicker";
import ChallanPostButton from "./ChallanPostButton";
import EmailChallanButton from "./EmailChallanButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? " " + ONES[o] : "");
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return (
    (h ? ONES[h] + " Hundred" + (rest ? " " : "") : "") +
    (rest ? twoDigits(rest) : "")
  );
}

function numberToWordsIndian(n: number): string {
  if (!n || n <= 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  let out = "";
  if (crore) out += twoDigits(crore) + " Crore ";
  if (lakh) out += twoDigits(lakh) + " Lakh ";
  if (thousand) out += twoDigits(thousand) + " Thousand ";
  if (rest) out += threeDigits(rest);
  return out.trim();
}

const fmt = (v: number) => v.toLocaleString("en-IN");

export default async function PfEsiChallanPage(props: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "people.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const searchParams = await props.searchParams;
  const branding = await getBranding();

  const all = await prisma.statutoryContribution.findMany({
    orderBy: { month: "desc" },
  });
  const months = Array.from(new Set(all.map((r) => r.month)))
    .sort()
    .reverse();
  const month =
    searchParams?.month && months.includes(searchParams.month)
      ? searchParams.month
      : months[0] || "";

  const rows = all.filter((r) => r.month === month);
  const employeeCount = rows.length;
  const pfAccount = rows.find((r) => r.pfNumber)?.pfNumber || "";
  const esiAccount = rows.find((r) => r.esiNumber)?.esiNumber || "";

  const pfWage = rows.reduce((s, r) => s + r.pfWage, 0);
  const pfEmployee = rows.reduce((s, r) => s + r.pfEmployee, 0);
  const pfEmployer = rows.reduce((s, r) => s + r.pfEmployer, 0);
  const esiWage = rows.reduce((s, r) => s + r.esiWage, 0);
  const esiEmployee = rows.reduce((s, r) => s + r.esiEmployee, 0);
  const esiEmployer = rows.reduce((s, r) => s + r.esiEmployer, 0);

  const pfTotal = pfEmployee + pfEmployer;
  const esiTotal = esiEmployee + esiEmployer;
  const grandTotal = pfTotal + esiTotal;
  const challanNo = month
    ? `CH-${month.replace("-", "")}-001`
    : "CH-000000-001";
  const now = new Date();

  const sectionBox =
    "rounded-xl border border-slate-600 overflow-hidden print:border-gray-400";
  const th =
    "text-left text-[10px] uppercase tracking-wider font-black text-slate-400 bg-slate-800/60 px-3 py-2 print:bg-gray-100 print:text-gray-600";
  const td = "px-3 py-2 text-slate-300 print:text-black";

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <BadgeIndianRupee className="w-7 h-7 text-orange-600" />
          <div>
            <h1 className="text-2xl font-extrabold text-white">
              PF / ESI Payment Challan
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Statutory contribution payment form — print or save as PDF for
              bank submission.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {grandTotal > 0 && (
            <>
              <ChallanPostButton
                month={month}
                challanNo={challanNo}
                amount={grandTotal}
              />
              <EmailChallanButton month={month} />
            </>
          )}
          <PrintButton />
        </div>
      </div>

      {months.length > 0 && (
        <div className="mb-6 print:hidden flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-600 text-slate-300">
            Contribution Month
          </label>
          <ChallanMonthPicker months={months} current={month} />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="bg-slate-800/60 rounded-2xl border border-slate-700 p-10 text-center text-slate-400">
          No statutory contribution entries yet. Add monthly contributions in{" "}
          <a href="/people/statutory" className="text-blue-400 underline">
            Statutory PF/ESI register
          </a>{" "}
          to generate a challan.
        </div>
      ) : (
        <div className="space-y-6">
          {/* CHALLAN HEADER */}
          <div
            className={`${sectionBox} border-2 border-slate-500 print:border-2 print:border-gray-500`}
          >
            <div className="px-4 py-3 flex items-center justify-between bg-slate-800/60 print:bg-gray-800">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wide text-white">
                  Statutory Contribution Challan
                </h2>
                <p className="text-[11px] text-slate-300 print:text-gray-300">
                  Employees&apos; Provident Fund &amp; Employees&apos; State
                  Insurance Corporation
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm font-black text-white font-mono">
                  {challanNo}
                </div>
                <div className="text-[11px] text-slate-300 print:text-gray-300">
                  {month} · Generated {now.toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 py-4">
              <div className="col-span-2 md:col-span-2">
                <div className="text-[10px] uppercase tracking-wider font-black text-slate-400 print:text-gray-500">
                  Employer
                </div>
                <div className="font-bold text-white print:text-black">
                  {branding.companyName || "Manufacturing Max"}
                </div>
                <div className="text-[11px] text-slate-400 print:text-gray-600">
                  {branding.companyAddress}
                </div>
                <div className="text-[11px] text-slate-400 print:text-gray-600">
                  GSTIN: {branding.companyGstin || "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-black text-slate-400 print:text-gray-500">
                  PF Account No.
                </div>
                <div className="font-mono font-bold text-white print:text-black">
                  {pfAccount || "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-black text-slate-400 print:text-gray-500">
                  ESI Code
                </div>
                <div className="font-mono font-bold text-white print:text-black">
                  {esiAccount || "—"}
                </div>
              </div>
            </div>
          </div>

          {/* PF SECTION */}
          <div className={sectionBox}>
            <div className="px-4 py-2.5 bg-blue-50 dark:bg-blue-950/40 print:bg-gray-100 border-b border-slate-600 print:border-gray-300">
              <h3 className="text-sm font-black uppercase tracking-wider text-blue-400 print:text-gray-700">
                Provident Fund (PF) — {month}
              </h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-600 print:border-gray-300">
                  <th className={th}>Description</th>
                  <th className={`${th} text-right`}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200">
                <tr>
                  <td className={td}>
                    Total PF Wages ({employeeCount} employees)
                  </td>
                  <td className={`${td} text-right font-mono`}>
                    {fmt(pfWage)}
                  </td>
                </tr>
                <tr>
                  <td className={td}>Employee Share (12% of wage)</td>
                  <td className={`${td} text-right font-mono`}>
                    {fmt(pfEmployee)}
                  </td>
                </tr>
                <tr>
                  <td className={td}>Employer Share (12% of wage)</td>
                  <td className={`${td} text-right font-mono`}>
                    {fmt(pfEmployer)}
                  </td>
                </tr>
                <tr className="bg-blue-50/50 dark:bg-blue-950/30 print:bg-gray-50">
                  <td className="px-3 py-2.5 font-black text-white print:text-black uppercase text-[11px]">
                    Total PF Payable
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-black text-blue-400 print:text-black">
                    {fmt(pfTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ESI SECTION */}
          <div className={sectionBox}>
            <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 print:bg-gray-100 border-b border-slate-600 print:border-gray-300">
              <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 print:text-gray-700">
                Employees&apos; State Insurance (ESI) — {month}
              </h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-600 print:border-gray-300">
                  <th className={th}>Description</th>
                  <th className={`${th} text-right`}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200">
                <tr>
                  <td className={td}>
                    Total ESI Wages ({employeeCount} employees)
                  </td>
                  <td className={`${td} text-right font-mono`}>
                    {fmt(esiWage)}
                  </td>
                </tr>
                <tr>
                  <td className={td}>Employee Share (0.75% of wage)</td>
                  <td className={`${td} text-right font-mono`}>
                    {fmt(esiEmployee)}
                  </td>
                </tr>
                <tr>
                  <td className={td}>Employer Share (3.25% of wage)</td>
                  <td className={`${td} text-right font-mono`}>
                    {fmt(esiEmployer)}
                  </td>
                </tr>
                <tr className="bg-emerald-50/50 dark:bg-emerald-950/30 print:bg-gray-50">
                  <td className="px-3 py-2.5 font-black text-white print:text-black uppercase text-[11px]">
                    Total ESI Payable
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-400 print:text-black">
                    {fmt(esiTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* GRAND TOTAL + WORDS */}
          <div
            className={`${sectionBox} border-2 border-slate-500 print:border-2 print:border-gray-500`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 divide-slate-700 print:divide-gray-300">
              <div className="px-4 py-4">
                <div className="text-[10px] uppercase tracking-wider font-black text-slate-400 print:text-gray-500">
                  Grand Total Payable
                </div>
                <div className="text-3xl font-black font-mono text-white print:text-black mt-1">
                  ₹ {fmt(grandTotal)}
                </div>
                <div className="text-xs text-slate-400 print:text-gray-600 mt-2">
                  Rupees {numberToWordsIndian(grandTotal)} Only
                </div>
              </div>
              <div className="px-4 py-4 flex flex-col justify-between gap-4">
                <div className="text-xs text-slate-400 print:text-gray-600">
                  {employeeCount} employee{employeeCount === 1 ? "" : "s"}{" "}
                  covered · {month} contribution period · Mode: Online / Bank
                  Challan
                </div>
                <div className="grid grid-cols-2 gap-6 pt-2">
                  <div className="text-center">
                    <div className="border-t-2 border-dotted border-slate-500 pt-2 text-[11px] font-semibold text-slate-400 print:text-gray-600">
                      Authorized Signatory
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t-2 border-dotted border-slate-500 pt-2 text-[11px] font-semibold text-slate-400 print:text-gray-600">
                      Bank Seal &amp; Date
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ANNEXURE — PER EMPLOYEE */}
          <div className={sectionBox}>
            <div className="px-4 py-2.5 bg-slate-800/60 print:bg-gray-100 border-b border-slate-600 print:border-gray-300">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 print:text-gray-700">
                Annexure — Employee-wise Contribution ({month})
              </h3>
            </div>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-600 print:border-gray-300">
                    <th className={th}>Employee</th>
                    <th className={th}>Code</th>
                    <th className={th}>PF No.</th>
                    <th className={`${th} text-right`}>PF Wage</th>
                    <th className={`${th} text-right`}>PF Emp</th>
                    <th className={`${th} text-right`}>PF Empr</th>
                    <th className={`${th} text-right`}>ESI Wage</th>
                    <th className={`${th} text-right`}>ESI Emp</th>
                    <th className={`${th} text-right`}>ESI Empr</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200 font-mono">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td
                        className={`${td} font-sans font-bold text-white print:text-black`}
                      >
                        {r.employeeName}
                      </td>
                      <td className={td}>{r.employeeCode || "—"}</td>
                      <td className={td}>{r.pfNumber || "—"}</td>
                      <td className={`${td} text-right`}>{fmt(r.pfWage)}</td>
                      <td className={`${td} text-right`}>
                        {fmt(r.pfEmployee)}
                      </td>
                      <td className={`${td} text-right`}>
                        {fmt(r.pfEmployer)}
                      </td>
                      <td className={`${td} text-right`}>{fmt(r.esiWage)}</td>
                      <td className={`${td} text-right`}>
                        {fmt(r.esiEmployee)}
                      </td>
                      <td className={`${td} text-right`}>
                        {fmt(r.esiEmployer)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 print:text-gray-400">
            Manufacturing MAX · PF &amp; ESI Statutory Payment Challan ·{" "}
            {branding.companyName} · Confidential
          </p>
        </div>
      )}
    </main>
  );
}
