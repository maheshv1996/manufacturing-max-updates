import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";
import { Button } from "@/app/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function LeaveRegisterPage(props: {
  searchParams: Promise<{ month?: string }>;
}) {
  const searchParams = await props.searchParams;
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (
    !user.isOwner &&
    !can(user, "reports.print") &&
    !can(user, "people.view")
  ) {
    redirect("/");
  }

  const selectedMonth =
    searchParams.month || new Date().toISOString().slice(0, 7);
  const [yearStr, monthStr] = selectedMonth.split("-");
  const startDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
  const endDate = new Date(
    parseInt(yearStr),
    parseInt(monthStr),
    0,
    23,
    59,
    59,
    999,
  );

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      fromDate: { lte: endDate },
      toDate: { gte: startDate },
    },
    include: {
      user: true,
      approvedBy: true,
    },
    orderBy: { fromDate: "asc" },
  });

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Monthly Leave Register"
          description="A complete register of all leaves spanning or falling within the selected month."
          icon={<FileText className="w-7 h-7 text-accent" />}
        >
          <div className="flex items-center gap-3">
            <form className="flex items-center gap-2">
              <input
                type="month"
                name="month"
                defaultValue={selectedMonth}
                className="px-3 py-2 border border-border bg-surface-1 rounded-control text-sm font-bold text-text-1"
              />
              <Button type="submit" variant="secondary">
                Filter
              </Button>
            </form>
          </div>
        </PageHeader>

        <div className="bg-surface-1 border border-border rounded-card p-6 shadow-sm overflow-hidden">
          <div className="hidden print:block mb-6 text-center">
            <h2 className="text-xl font-bold text-text-1">
              Monthly Leave Register
            </h2>
            <p className="text-sm text-text-2">
              For the month of {selectedMonth}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-surface-2 text-text-2 uppercase text-xs tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4 font-semibold">Employee</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Dates</th>
                  <th className="py-3 px-4 font-semibold text-right">Days</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Approved By</th>
                  <th className="py-3 px-4 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leaves.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-text-3 italic"
                    >
                      No leave requests found for this month.
                    </td>
                  </tr>
                ) : (
                  leaves.map((l) => (
                    <tr
                      key={l.id}
                      className="hover:bg-surface-2/50 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-text-1">
                        {l.user.name}
                      </td>
                      <td className="py-3.5 px-4 text-text-2">{l.type}</td>
                      <td className="py-3.5 px-4 text-text-2 font-mono text-xs">
                        {new Date(l.fromDate).toLocaleDateString()} to{" "}
                        {new Date(l.toDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-text-1 text-right">
                        {l.days}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-full border ${
                            l.status === "APPROVED"
                              ? "bg-success-soft text-success border-success/20"
                              : l.status === "REJECTED"
                                ? "bg-error-soft text-error border-error/20"
                                : "bg-warning-soft text-warning border-warning/20"
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-text-2">
                        {l.approvedBy?.name || "-"}
                      </td>
                      <td
                        className="py-3.5 px-4 text-text-3 text-xs italic max-w-xs truncate"
                        title={l.note || ""}
                      >
                        {l.note || l.reason || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
