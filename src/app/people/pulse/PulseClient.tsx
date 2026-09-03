"use client";

import PageHeader from "@/app/components/shared/PageHeader";

import {Clock,
  CalendarX,
  UserCheck,
  AlertOctagon,
  GraduationCap,
  FileCheck,
  Users
} from "lucide-react";
import { format } from "date-fns";

export default function PulseClient({
  stats,
  expiringCerts,
  pendingLeaves,
  overtimeUsers,
}: any) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pulse"
        description="Roster, attendance, leave and workforce operations."
        icon={<Users className="w-6 h-6" />}
        iconTone="violet"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-1 rounded-card border border-border p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-text-2 text-sm font-medium">
              Present Today
            </span>
            <UserCheck className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold">{stats.present}</span>
            <span className="text-text-3 text-xs ml-2">
              / {stats.totalEmployees} total
            </span>
          </div>
        </div>

        <div className="bg-surface-1 rounded-card border border-border p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-text-2 text-sm font-medium">Late</span>
            <Clock className="h-5 w-5 text-orange-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-orange-500">
              {stats.late}
            </span>
          </div>
        </div>

        <div className="bg-surface-1 rounded-card border border-border p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-text-2 text-sm font-medium">Absent</span>
            <AlertOctagon className="h-5 w-5 text-red-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-red-500">
              {stats.absent}
            </span>
          </div>
        </div>

        <div className="bg-surface-1 rounded-card border border-border p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-text-2 text-sm font-medium">On Leave</span>
            <CalendarX className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold">{stats.onLeave}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Takes 1) */}
        <div className="space-y-6">
          <div className="bg-surface-1 border border-border rounded-card p-5">
            <h3 className="font-bold text-text-1 flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-orange-500" /> OT Limit Warnings
            </h3>
            {overtimeUsers.length === 0 ? (
              <p className="text-sm text-text-3">
                No operators near OT limits.
              </p>
            ) : (
              <ul className="space-y-3">
                {overtimeUsers.map((user: any) => (
                  <li
                    key={user.id}
                    className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <span className="font-semibold text-text-1 block">
                        {user.name}
                      </span>
                      <span className="text-xs text-text-3">{user.role}</span>
                    </div>
                    <span className="text-orange-500 font-bold bg-orange-500/10 px-2 py-1 rounded-lg">
                      {user.hoursThisWeek} hrs
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-surface-1 border border-border rounded-card p-5">
            <h3 className="font-bold text-text-1 flex items-center gap-2 mb-4">
              <GraduationCap className="h-4 w-4 text-purple-500" /> Expiring
              Certifications
            </h3>
            {expiringCerts.length === 0 ? (
              <p className="text-sm text-text-3">
                All certifications are up to date.
              </p>
            ) : (
              <ul className="space-y-3">
                {expiringCerts.map((cert: any) => (
                  <li
                    key={cert.id}
                    className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <span className="font-semibold text-text-1 block">
                        {cert.user?.name}
                      </span>
                      <span className="text-xs text-text-3">
                        {cert.type} on {cert.machine?.code || "N/A"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-red-500 font-medium block">
                        {format(new Date(cert.validUntil), "MMM d, yyyy")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right Column (Takes 2) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-text-1 flex items-center gap-2">
            <FileCheck className="h-5 w-5" /> Pending Leave Approvals
          </h2>
          <div className="bg-surface-1 border border-border rounded-card overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2 border-b border-border text-xs uppercase text-text-3 font-semibold">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3 text-right">Days</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingLeaves.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-text-3"
                    >
                      No pending leave requests.
                    </td>
                  </tr>
                ) : (
                  pendingLeaves.map((leave: any) => (
                    <tr
                      key={leave.id}
                      className="hover:bg-surface-2/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-1 text-sm">
                          {leave.user?.name}
                        </div>
                        <div className="text-xs text-text-3">
                          {leave.user?.role?.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500">
                          {leave.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-2">
                        {format(new Date(leave.fromDate), "MMM d")} -{" "}
                        {format(new Date(leave.toDate), "MMM d")}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-text-1">
                        {leave.days}
                      </td>
                      <td
                        className="px-4 py-3 text-sm text-text-2 truncate max-w-[150px]"
                        title={leave.reason}
                      >
                        {leave.reason || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href="/people/attendance"
                          className="text-xs font-medium text-[var(--color-accent)] hover:underline"
                        >
                          Review &rarr;
                        </a>
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
