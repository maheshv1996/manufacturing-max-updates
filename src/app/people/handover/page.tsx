import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import HandoverClient from "./HandoverClient";
import { ClipboardEdit } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HandoverPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "people.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const [shifts, machines, users] = await Promise.all([
    prisma.shift.findMany({ orderBy: { startTime: "asc" } }),
    prisma.machine.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* HEADER SECTION */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-700 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <ClipboardEdit className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Shift Handover Logbook
              </h1>
              <p className="text-sm text-slate-400 font-medium">
                Document production notes, issues, and actions for the next
                shift
              </p>
            </div>
          </div>
        </header>

        <HandoverClient shifts={shifts} machines={machines} users={users} />
      </div>
    </div>
  );
}
