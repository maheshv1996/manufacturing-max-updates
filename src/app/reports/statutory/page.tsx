import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { BadgeIndianRupee } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StatutoryReport() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "people.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const now = new Date();

  const rows = await prisma.statutoryContribution.findMany({
    orderBy: [{ month: "desc" }, { employeeName: "asc" }],
  });

  const months = Array.from(new Set(rows.map((r) => r.month))).slice(0, 6);
  const monthRows = rows.filter((r) => months.includes(r.month));

  const totals = {
    pfWage: monthRows.reduce((s, r) => s + r.pfWage, 0),
    pfEmployee: monthRows.reduce((s, r) => s + r.pfEmployee, 0),
    pfEmployer: monthRows.reduce((s, r) => s + r.pfEmployer, 0),
    esiWage: monthRows.reduce((s, r) => s + r.esiWage, 0),
    esiEmployee: monthRows.reduce((s, r) => s + r.esiEmployee, 0),
    esiEmployer: monthRows.reduce((s, r) => s + r.esiEmployer, 0),
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-8 print:mb-4">
        <div className="flex items-center gap-3">
          <BadgeIndianRupee className="w-7 h-7 text-orange-600 print:hidden" />
          <div>
            <h1 className="text-2xl font-extrabold text-white print:text-black">
              PF / ESI Statutory Contribution Register
            </h1>
            <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
              Generated: {now.toLocaleString()} · Periods:{" "}
              {months.join(", ") || "—"} · {monthRows.length} entries
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      <div className="overflow-x-auto bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm print:shadow-none print:border print:border-gray-200 print:rounded-none">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-bold print:bg-gray-100 print:text-gray-700">
            <tr>
              <th className="p-3">Month</th>
              <th className="p-3">Employee</th>
              <th className="p-3">Code</th>
              <th className="p-3">PF No.</th>
              <th className="p-3">PF Wage</th>
              <th className="p-3">PF Emp</th>
              <th className="p-3">PF Empr</th>
              <th className="p-3">ESI Wage</th>
              <th className="p-3">ESI Emp</th>
              <th className="p-3">ESI Empr</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200 font-mono">
            {monthRows.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="p-6 text-center text-slate-400 italic font-sans"
                >
                  No statutory contribution entries yet.
                </td>
              </tr>
            )}
            {monthRows.map((r) => (
              <tr key={r.id}>
                <td className="p-3 font-extrabold text-white print:text-black">
                  {r.month}
                </td>
                <td className="p-3 font-sans font-bold text-white print:text-black">
                  {r.employeeName}
                </td>
                <td className="p-3 text-slate-400 print:text-gray-600">
                  {r.employeeCode || "—"}
                </td>
                <td className="p-3 text-slate-400 print:text-gray-600">
                  {r.pfNumber || "—"}
                </td>
                <td className="p-3 text-right">
                  {r.pfWage.toLocaleString("en-IN")}
                </td>
                <td className="p-3 text-right">
                  {r.pfEmployee.toLocaleString("en-IN")}
                </td>
                <td className="p-3 text-right">
                  {r.pfEmployer.toLocaleString("en-IN")}
                </td>
                <td className="p-3 text-right">
                  {r.esiWage.toLocaleString("en-IN")}
                </td>
                <td className="p-3 text-right">
                  {r.esiEmployee.toLocaleString("en-IN")}
                </td>
                <td className="p-3 text-right">
                  {r.esiEmployer.toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
          {monthRows.length > 0 && (
            <tfoot className="bg-slate-800/60 print:bg-gray-100">
              <tr className="font-mono text-xs font-black text-white print:text-black">
                <td colSpan={4} className="p-3 uppercase">
                  Totals
                </td>
                <td className="p-3 text-right">
                  {totals.pfWage.toLocaleString("en-IN")}
                </td>
                <td className="p-3 text-right">
                  {totals.pfEmployee.toLocaleString("en-IN")}
                </td>
                <td className="p-3 text-right">
                  {totals.pfEmployer.toLocaleString("en-IN")}
                </td>
                <td className="p-3 text-right">
                  {totals.esiWage.toLocaleString("en-IN")}
                </td>
                <td className="p-3 text-right">
                  {totals.esiEmployee.toLocaleString("en-IN")}
                </td>
                <td className="p-3 text-right">
                  {totals.esiEmployer.toLocaleString("en-IN")}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-[10px] text-slate-400 mt-6 print:mt-4 print:text-gray-400">
        Manufacturing MAX · PF (Employees' Provident Fund) & ESI (Employees'
        State Insurance) Register · Statutory Compliance Evidence ·
        Confidential
      </p>
    </main>
  );
}
