import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AttendanceClient from "./AttendanceClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AttendancePage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (
    !user.isOwner &&
    !can(user, "system.edit") &&
    !user.isOwner &&
    !can(user, "ops.edit")
  ) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-6">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Attendance &amp; Operator Efficiency
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Track real-time shift attendance, grace minutes, late clock-ins,
              absent detection, and presence-based daily efficiency.
            </p>
          </div>
        </header>

        <AttendanceClient />
      </div>
    </div>
  );
}
