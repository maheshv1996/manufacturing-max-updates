import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FileSignature } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PswPickerPage() {
  const submissions = await prisma.ppapSubmission.findMany({
    include: {
      product: { select: { sku: true, name: true } },
      elements: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <FileSignature className="w-7 h-7 text-blue-600" />
        <div>
          <h1 className="text-2xl font-extrabold text-white">
            Part Submission Warrant (PSW)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            AIAG PSW form per PPAP submission â€” 18-element status and customer
            sign-off blocks.
          </p>
        </div>
      </div>

      <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/60 border-b border-slate-700">
            <tr>
              <th className="px-5 py-3 font-semibold text-slate-200">
                PPAP No.
              </th>
              <th className="px-5 py-3 font-semibold text-slate-200">
                Product
              </th>
              <th className="px-5 py-3 font-semibold text-slate-200">
                Customer
              </th>
              <th className="px-5 py-3 font-semibold text-slate-200">Status</th>
              <th className="px-5 py-3 font-semibold text-slate-200 text-right">
                PSW
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800">
            {submissions.map((s) => {
              const complete = s.elements.filter(
                (e) => e.status === "COMPLETE" || e.status === "N_A",
              ).length;
              const pct = s.elements.length
                ? Math.round((complete / s.elements.length) * 100)
                : 0;
              return (
                <tr key={s.id} className="hover:bg-slate-800/90/20">
                  <td className="px-5 py-3 font-mono font-bold">
                    {s.ppapNumber}
                  </td>
                  <td className="px-5 py-3">
                    {s.product?.name}{" "}
                    <span className="text-xs text-slate-500 font-mono">
                      ({s.product?.sku})
                    </span>
                  </td>
                  <td className="px-5 py-3">{s.customerName || "â€”"}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${s.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-400" : s.status === "REJECTED" ? "bg-rose-500/10 text-rose-400" : s.status === "SUBMITTED" ? "bg-amber-500/10 text-amber-400" : "bg-slate-500/10 text-slate-400"}`}
                    >
                      {s.status} Â· {pct}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/reports/psw/${s.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      <FileSignature className="w-3.5 h-3.5" /> Print PSW
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
