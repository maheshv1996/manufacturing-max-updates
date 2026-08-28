import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { FileCheck2 } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  IN_PROGRESS: "In Progress",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export default async function PpapRegisterPage() {
  const now = new Date();
  const submissions = await prisma.ppapSubmission.findMany({
    include: {
      product: { select: { sku: true, name: true } },
      elements: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const approved = submissions.filter((s) => s.status === "APPROVED").length;

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-8 print:mb-4">
        <div className="flex items-center gap-3">
          <FileCheck2 className="w-7 h-7 text-blue-600 print:hidden" />
          <div>
            <h1 className="text-2xl font-extrabold text-white print:text-black">
              PPAP Submission Register
            </h1>
            <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
              Generated: {now.toLocaleString()} Â· {submissions.length}{" "}
              submission(s) Â· {approved} approved
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      <div className="overflow-x-auto bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm print:shadow-none print:border print:border-gray-200 print:rounded-none">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-bold print:bg-gray-100 print:text-gray-700">
            <tr>
              <th className="p-3">PPAP No.</th>
              <th className="p-3">Product</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Rev</th>
              <th className="p-3">Level</th>
              <th className="p-3">Elements Complete</th>
              <th className="p-3">Status</th>
              <th className="p-3">Submitted</th>
              <th className="p-3">Disposition</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200">
            {submissions.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="p-6 text-center text-slate-400 italic font-sans"
                >
                  No PPAP submissions on record.
                </td>
              </tr>
            )}
            {submissions.map((s) => {
              const complete = s.elements.filter(
                (e) => e.status === "COMPLETE" || e.status === "N_A",
              ).length;
              const pct = s.elements.length
                ? Math.round((complete / s.elements.length) * 100)
                : 0;
              return (
                <tr key={s.id} className="align-top">
                  <td className="p-3 font-mono font-bold">{s.ppapNumber}</td>
                  <td className="p-3">
                    {s.product
                      ? `${s.product.sku} Â· ${s.product.name}`
                      : "â€”"}
                  </td>
                  <td className="p-3">{s.customerName || "â€”"}</td>
                  <td className="p-3">{s.revision}</td>
                  <td className="p-3">{s.submissionLevel}</td>
                  <td className="p-3">
                    {complete}/{s.elements.length} ({pct}%)
                  </td>
                  <td className="p-3 font-bold">
                    {STATUS_LABELS[s.status] || s.status}
                  </td>
                  <td className="p-3">
                    {s.submittedAt ? s.submittedAt.toLocaleDateString() : "â€”"}
                  </td>
                  <td className="p-3">
                    {s.dispositionAt
                      ? `${s.status} Â· ${s.dispositionAt.toLocaleDateString()}${s.dispositionBy ? ` by ${s.dispositionBy}` : ""}`
                      : "â€”"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 mt-4 print:text-gray-500">
        Manufacturing MAX Â· PPAP Register (AIAG 18-Element) Â· IATF 16949 /
        AS9100 Evidence Â· Confidential
      </p>
    </main>
  );
}
