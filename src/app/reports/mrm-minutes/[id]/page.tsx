import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { FileText } from "lucide-react";
import { getObjectiveActuals } from "@/lib/qualityObjectives";

export const dynamic = "force-dynamic";

const SEV_LABEL: Record<string, string> = {
  critical: "CRITICAL",
  warning: "WARNING",
  info: "INFO",
};
const KPI_LABEL: Record<string, string> = {
  OTD_PCT: "On-Time Delivery %",
  PPM: "Defects per Million",
  MTBF: "Mean Time Between Failures",
  TRAINING_PCT: "Operator Training %",
};

export default async function MrmMinutesPage({
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
  const meeting = await prisma.mrmMeeting.findUnique({
    where: { id },
    include: { actionItems: { orderBy: { createdAt: "asc" } } },
  });
  if (!meeting) notFound();

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const objectiveRows = await getObjectiveActuals(period);
  const attendees = (meeting.attendees as any[]) || [];
  const agenda = (meeting.agenda as any[]) || [];
  const decisions = (meeting.decisions as any[]) || [];

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-6 print:mb-4">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h1 className="text-lg font-semibold text-slate-100">
            MRM Minutes — {meeting.meetingNumber}
          </h1>
        </div>
        <PrintButton />
      </div>

      {/* Document */}
      <div className="bg-white text-slate-900 rounded-lg shadow-lg p-10 print:shadow-none print:rounded-none print:p-0">
        {/* Letterhead */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div>
            <div className="text-xl font-bold uppercase tracking-wide">
              Management Review Meeting
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              Minutes of Meeting · ISO 9001:2015 Clause 9.3
            </div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div className="font-semibold text-sm text-slate-900">
              {meeting.meetingNumber}
            </div>
            <div>{new Date(meeting.date).toLocaleDateString()}</div>
            <div>{meeting.minutesBy}</div>
          </div>
        </div>

        {/* Header info */}
        <div className="grid grid-cols-2 gap-4 py-4 text-sm">
          <div>
            <span className="text-slate-500">Title: </span>
            <span className="font-medium">{meeting.title}</span>
          </div>
          <div>
            <span className="text-slate-500">Status: </span>
            <span className="font-medium uppercase">{meeting.status}</span>
            {meeting.closedByName && (
              <span className="text-slate-500">
                {" "}
                · Closed by {meeting.closedByName}
              </span>
            )}
          </div>
          <div className="col-span-2">
            <span className="text-slate-500">Attendees: </span>
            <span className="font-medium">
              {attendees
                .map((a: any, i: number) => (i ? ", " : "") + (a.name || a))
                .join(", ")}
            </span>
          </div>
        </div>

        {/* 1. Review of previous actions */}
        <h2 className="text-sm font-bold uppercase tracking-wide mt-6 border-b border-slate-300 pb-1">
          1. Status of Previous Management Actions
        </h2>
        <table className="w-full mt-2 text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
              <th className="py-1.5 pr-2">Action</th>
              <th className="py-1.5 pr-2">Owner</th>
              <th className="py-1.5 pr-2">Due</th>
              <th className="py-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {meeting.actionItems.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-slate-500 italic">
                  None recorded.
                </td>
              </tr>
            )}
            {meeting.actionItems.map((a) => (
              <tr key={a.id} className="border-b border-slate-200">
                <td className="py-1.5 pr-2">{a.description}</td>
                <td className="py-1.5 pr-2">{a.ownerName}</td>
                <td className="py-1.5 pr-2">
                  {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}
                </td>
                <td className="py-1.5">
                  {a.status}
                  {a.escalated ? " · ESCALATED" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 2. Agenda / input information */}
        <h2 className="text-sm font-bold uppercase tracking-wide mt-6 border-b border-slate-300 pb-1">
          2. Agenda & Input Information Reviewed (9.3.2)
        </h2>
        <table className="w-full mt-2 text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
              <th className="py-1.5 pr-2">#</th>
              <th className="py-1.5 pr-2">Item</th>
              <th className="py-1.5 pr-2">Severity</th>
              <th className="py-1.5">Source</th>
            </tr>
          </thead>
          <tbody>
            {agenda.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-slate-500 italic">
                  No flagged items at time of meeting.
                </td>
              </tr>
            )}
            {agenda.map((a: any, i: number) => (
              <tr key={i} className="border-b border-slate-200 align-top">
                <td className="py-1.5 pr-2">{i + 1}</td>
                <td className="py-1.5 pr-2">
                  <div className="font-medium">{a.title}</div>
                  <div className="text-slate-500 text-xs">{a.detail}</div>
                </td>
                <td className="py-1.5 pr-2 uppercase text-xs font-semibold">
                  {SEV_LABEL[a.severity] || a.severity}
                </td>
                <td className="py-1.5 text-xs">{a.source}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 3. Quality objective performance */}
        <h2 className="text-sm font-bold uppercase tracking-wide mt-6 border-b border-slate-300 pb-1">
          3. Quality Objective Performance ({period})
        </h2>
        <table className="w-full mt-2 text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
              <th className="py-1.5 pr-2">Department</th>
              <th className="py-1.5 pr-2">KPI</th>
              <th className="py-1.5 pr-2">Target</th>
              <th className="py-1.5 pr-2">Actual</th>
              <th className="py-1.5">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {objectiveRows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-2 text-slate-500 italic">
                  No active objectives for this period.
                </td>
              </tr>
            )}
            {objectiveRows.map((r) => (
              <tr key={r.objective.id} className="border-b border-slate-200">
                <td className="py-1.5 pr-2 capitalize">
                  {r.objective.department}
                </td>
                <td className="py-1.5 pr-2">
                  {KPI_LABEL[r.objective.kpiType] || r.objective.kpiType}
                </td>
                <td className="py-1.5 pr-2">{r.objective.targetValue}</td>
                <td className="py-1.5 pr-2">
                  {r.actual === null ? "No data" : r.actual}
                </td>
                <td className="py-1.5 font-semibold">
                  {r.met === true ? "MET" : r.met === false ? "MISSED" : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 4. Minutes */}
        <h2 className="text-sm font-bold uppercase tracking-wide mt-6 border-b border-slate-300 pb-1">
          4. Minutes of Discussion (9.3.3)
        </h2>
        <div className="mt-2 text-sm whitespace-pre-wrap">
          {meeting.summary || "Minutes not yet recorded — meeting open."}
        </div>

        {/* 5. Decisions */}
        <h2 className="text-sm font-bold uppercase tracking-wide mt-6 border-b border-slate-300 pb-1">
          5. Decisions Taken
        </h2>
        <ol className="mt-2 text-sm list-decimal pl-5 space-y-1">
          {decisions.length === 0 && (
            <li className="text-slate-500 italic">No decisions recorded.</li>
          )}
          {decisions.map((d: any, i: number) => (
            <li key={i}>{d.text || d}</li>
          ))}
        </ol>

        {/* 6. New action items */}
        <h2 className="text-sm font-bold uppercase tracking-wide mt-6 border-b border-slate-300 pb-1">
          6. New Action Items
        </h2>
        <table className="w-full mt-2 text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
              <th className="py-1.5 pr-2">Action</th>
              <th className="py-1.5 pr-2">Owner</th>
              <th className="py-1.5 pr-2">Due</th>
              <th className="py-1.5">Priority</th>
            </tr>
          </thead>
          <tbody>
            {meeting.actionItems.filter((a) => a.status === "OPEN").length ===
              0 && (
              <tr>
                <td colSpan={4} className="py-2 text-slate-500 italic">
                  All action items completed.
                </td>
              </tr>
            )}
            {meeting.actionItems
              .filter((a) => a.status === "OPEN")
              .map((a) => (
                <tr key={a.id} className="border-b border-slate-200">
                  <td className="py-1.5 pr-2">{a.description}</td>
                  <td className="py-1.5 pr-2">{a.ownerName}</td>
                  <td className="py-1.5 pr-2">
                    {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-1.5">{a.priority}</td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* Sign-off */}
        <div className="grid grid-cols-2 gap-10 mt-10 pt-6 border-t border-slate-300 text-sm">
          <div>
            <div className="font-semibold">Prepared by (Quality)</div>
            <div className="h-10" />
            <div className="border-t border-slate-500 pt-1 text-slate-500">
              {meeting.minutesBy}
            </div>
          </div>
          <div>
            <div className="font-semibold">Approved by (Management)</div>
            <div className="h-10" />
            <div className="border-t border-slate-500 pt-1 text-slate-500">
              {meeting.closedByName || "________________"}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
