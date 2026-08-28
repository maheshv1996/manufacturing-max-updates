import { prisma } from "@/lib/prisma";
import PrintWrapper from "@/app/components/print/PrintWrapper";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function AttendanceReportPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (
    !user.isOwner &&
    !can(user, "reports.print") &&
    !can(user, "people.view")
  ) {
    redirect("/");
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const attendanceLogsToday = await prisma.attendanceLog.findMany({
    take: 100,
    where: { clockIn: { gte: todayStart } },
    include: { user: true, shift: true },
    orderBy: { clockIn: "asc" },
  });

  const allOperators = await prisma.user.findMany({
    where: { role: { name: "Operator" } },
  });

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyLogs = await prisma.attendanceLog.findMany({
    take: 100,
    where: { clockIn: { gte: monthStart } },
    include: { user: true, shift: true },
    orderBy: { clockIn: "desc" },
  });

  return (
    <PrintWrapper
      title="Plant Attendance Register & Daily Board"
      subtitle={`As of: ${now.toLocaleDateString()} — Monthly Roll Call`}
    >
      {/* TODAY BOARD */}
      <div className="space-y-3">
        <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 border-b pb-2">
          Today&apos;s Attendance Shift Board ({attendanceLogsToday.length} /{" "}
          {allOperators.length} Present)
        </h3>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300 font-bold uppercase text-slate-700">
              <th className="p-2.5">Operator</th>
              <th className="p-2.5">Shift</th>
              <th className="p-2.5 text-right">Clock In Time</th>
              <th className="p-2.5 text-right">Clock Out Time</th>
              <th className="p-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {allOperators.map((op) => {
              const todayLog = attendanceLogsToday.find(
                (l) => l.userId === op.id,
              );
              const status = todayLog ? todayLog.status : "ABSENT";
              const statusColor =
                status === "PRESENT"
                  ? "text-emerald-600 font-bold"
                  : status === "LATE"
                    ? "text-amber-600 font-bold"
                    : "text-rose-600 font-bold";

              return (
                <tr key={op.id} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold">{op.name}</td>
                  <td className="p-2.5 font-mono text-[11px] text-slate-600">
                    {todayLog?.shift?.name || "General"}
                  </td>
                  <td className="p-2.5 text-right font-mono">
                    {todayLog
                      ? new Date(todayLog.clockIn).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="p-2.5 text-right font-mono">
                    {todayLog?.clockOut
                      ? new Date(todayLog.clockOut).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Active"}
                  </td>
                  <td className={`p-2.5 text-center font-mono ${statusColor}`}>
                    {status}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MONTHLY LOGS SUMMARY */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900 border-b pb-2">
          Monthly Attendance Log History ({monthlyLogs.length} Records)
        </h3>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300 font-bold uppercase text-slate-700">
              <th className="p-2.5">Date</th>
              <th className="p-2.5">Operator</th>
              <th className="p-2.5">Shift</th>
              <th className="p-2.5 text-right">In</th>
              <th className="p-2.5 text-right">Out</th>
              <th className="p-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {monthlyLogs.slice(0, 25).map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="p-2.5 font-mono">
                  {new Date(l.clockIn).toLocaleDateString()}
                </td>
                <td className="p-2.5 font-bold">{l.user?.name}</td>
                <td className="p-2.5 font-mono text-[11px] text-slate-600">
                  {l.shift?.name}
                </td>
                <td className="p-2.5 text-right font-mono">
                  {new Date(l.clockIn).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="p-2.5 text-right font-mono">
                  {l.clockOut
                    ? new Date(l.clockOut).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Active"}
                </td>
                <td className="p-2.5 text-center font-mono font-bold">
                  {l.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PrintWrapper>
  );
}
