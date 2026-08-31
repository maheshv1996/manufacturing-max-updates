import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { ClipboardCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  D1_TEAM: "D1 Team",
  D2_PROBLEM: "D2 Problem",
  D3_CONTAINMENT: "D3 Containment",
  D4_ROOT_CAUSE: "D4 Root Cause",
  D5_CORRECTIVE: "D5 Corrective",
  D6_PREVENTIVE: "D6 Preventive",
  D7_VERIFY: "D7 Verify",
  D8_CLOSURE: "D8 Closure",
  CLOSED: "Closed",
};

export default async function EightDReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "quality.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const { id } = await params;
  const report = await prisma.eightDReport.findUnique({
    where: { id },
    include: {
      ncr: { select: { ncrNumber: true, description: true } },
      workOrder: { select: { woNumber: true } },
      product: { select: { sku: true, name: true } },
      actions: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!report) notFound();

  const whys = [
    report.why1,
    report.why2,
    report.why3,
    report.why4,
    report.why5,
  ].filter(Boolean);
  const now = new Date();

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-6 print:mb-4">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="w-7 h-7 text-blue-600 print:hidden" />
          <div>
            <h1 className="text-2xl font-extrabold text-white print:text-black">
              8D Report
            </h1>
            <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
              Generated: {now.toLocaleString()}
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      {/* Header block */}
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm overflow-hidden mb-5 print:border print:border-gray-300 print:rounded-none print:shadow-none">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5">
          <Cell label="Report Number" value={report.reportNumber} />
          <Cell label="Title" value={report.title} wide />
          <Cell
            label="Status"
            value={STATUS_LABELS[report.status] || report.status}
          />
          <Cell label="Severity" value={report.severity} />
          <Cell label="Linked NCR" value={report.ncr?.ncrNumber || "—"} />
          <Cell label="Work Order" value={report.workOrder?.woNumber || "—"} />
          <Cell
            label="Product"
            value={
              report.product
                ? `${report.product.sku} · ${report.product.name}`
                : "—"
            }
          />
          <Cell
            label="Raised"
            value={`${report.raisedBy} · ${report.raisedAt.toLocaleDateString()}`}
          />
        </div>
      </div>

      <div className="space-y-5">
        <Block title="D1 — Team">
          <p className="text-sm">{report.teamMembers || "—"}</p>
        </Block>

        <Block title="D2 — Problem Description">
          <p className="text-sm whitespace-pre-wrap">
            {report.problemDescription || report.problemStatement || "—"}
          </p>
        </Block>

        <Block title="D3 — Containment">
          <p className="text-sm whitespace-pre-wrap">
            {report.containmentAction || "—"}
          </p>
          {(report.containmentOwner || report.containmentDue) && (
            <p className="text-xs text-gray-500 mt-1">
              {report.containmentOwner}
              {report.containmentOwner && report.containmentDue ? " · " : ""}
              {report.containmentDue
                ? `Due ${report.containmentDue.toLocaleDateString()}`
                : ""}
            </p>
          )}
        </Block>

        <Block title="D4 — Root Cause (5-Why)">
          {whys.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Not defined</p>
          ) : (
            <div className="space-y-2">
              {whys.map((w, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-blue-400 text-blue-600 text-xs font-black shrink-0 print:border-gray-400 print:text-gray-700">
                    WHY {i + 1}
                  </span>
                  <p className="text-sm pt-2">{w}</p>
                </div>
              ))}
              {report.rootCauseSummary && (
                <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 print:bg-gray-50 print:border-gray-300">
                  <span className="text-xs font-black uppercase tracking-wider text-blue-600 print:text-gray-700">
                    Root cause:{" "}
                  </span>
                  <span className="text-sm font-semibold">
                    {report.rootCauseSummary}
                  </span>
                </div>
              )}
            </div>
          )}
        </Block>

        <div className="grid sm:grid-cols-2 gap-5">
          <Block title="D5 — Corrective Action">
            <p className="text-sm whitespace-pre-wrap">
              {report.correctiveAction || "—"}
            </p>
            {(report.correctiveOwner || report.correctiveDue) && (
              <p className="text-xs text-gray-500 mt-1">
                {report.correctiveOwner}
                {report.correctiveOwner && report.correctiveDue ? " · " : ""}
                {report.correctiveDue
                  ? `Due ${report.correctiveDue.toLocaleDateString()}`
                  : ""}
              </p>
            )}
          </Block>
          <Block title="D6 — Preventive Action">
            <p className="text-sm whitespace-pre-wrap">
              {report.preventiveAction || "—"}
            </p>
            {(report.preventiveOwner || report.preventiveDue) && (
              <p className="text-xs text-gray-500 mt-1">
                {report.preventiveOwner}
                {report.preventiveOwner && report.preventiveDue ? " · " : ""}
                {report.preventiveDue
                  ? `Due ${report.preventiveDue.toLocaleDateString()}`
                  : ""}
              </p>
            )}
          </Block>
        </div>

        <Block title="D7 — Verification">
          <p className="text-sm whitespace-pre-wrap">
            {report.verificationMethod || "—"}
          </p>
          {report.verifiedAt && (
            <p className="text-xs text-gray-500 mt-1">
              Verified by {report.verifiedBy || "—"} on{" "}
              {report.verifiedAt.toLocaleString()}
            </p>
          )}
        </Block>

        <Block title="D8 — Closure & Effectiveness">
          <p className="text-sm whitespace-pre-wrap">
            {report.closureSummary || "—"}
          </p>
          {report.effectivenessScore && (
            <p className="text-xs text-gray-500 mt-1">
              Effectiveness score: {report.effectivenessScore}/10
            </p>
          )}
          {report.closedAt && (
            <p className="text-xs text-gray-500 mt-1">
              Closed: {report.closedAt.toLocaleString()}
            </p>
          )}
        </Block>

        <Block title={`CAPA Actions (${report.actions.length})`}>
          {report.actions.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No actions recorded.</p>
          ) : (
            <div className="divide-y divide-gray-100 print:divide-gray-200">
              {report.actions.map((a) => (
                <div
                  key={a.id}
                  className="py-2 flex items-start justify-between gap-4"
                >
                  <div>
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-500/10 print:bg-gray-100 text-slate-300">
                      {a.type}
                    </span>
                    <p className="text-sm mt-1">{a.description}</p>
                    {(a.owner || a.dueDate) && (
                      <p className="text-xs text-gray-500">
                        {a.owner}
                        {a.owner && a.dueDate ? " · " : ""}
                        {a.dueDate
                          ? `Due ${a.dueDate.toLocaleDateString()}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-bold uppercase">
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Block>

        {/* Sign-off block */}
        <div className="grid grid-cols-3 gap-6 pt-6 print:pt-4">
          {["Team Lead / 8D Owner", "Quality Manager", "Plant Head"].map(
            (role) => (
              <div key={role} className="text-center">
                <div className="h-10 border-b border-dotted border-gray-400" />
                <div className="text-xs text-gray-500 mt-1">{role}</div>
              </div>
            ),
          )}
        </div>
      </div>

      <p className="text-[10px] text-slate-400 mt-6 print:text-gray-500">
        Manufacturing MAX · 8D Report · ISO 9001 / AS9100 Evidence ·
        Confidential
      </p>
    </main>
  );
}

function Cell({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="text-sm font-bold text-white print:text-black mt-0.5">
        {value}
      </div>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm p-5 print:border print:border-gray-300 print:rounded-none print:shadow-none">
      <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 print:text-gray-700 mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}
