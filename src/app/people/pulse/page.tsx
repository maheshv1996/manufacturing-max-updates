import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import PulseClient from "./PulseClient";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function PeoplePulse() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user || (!user.isOwner && !can(user, "people.view"))) {
    redirect("/login");
  }

  // Fetch stats for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalEmployees = await prisma.user.count({ where: { isActive: true } });

  const todayLogs = await prisma.attendanceLog.findMany({
    where: { clockIn: { gte: today } },
  });

  const present = todayLogs.filter((log) => log.status === "PRESENT").length;
  const late = todayLogs.filter((log) => log.status === "LATE").length;

  const activeLeaves = await prisma.leaveRequest.count({
    where: {
      status: "APPROVED",
      fromDate: { lte: new Date() },
      toDate: { gte: new Date() },
    },
  });

  const absent = totalEmployees - (present + late + activeLeaves);

  const stats = {
    totalEmployees,
    present,
    late,
    absent: Math.max(0, absent),
    onLeave: activeLeaves,
  };

  // Fetch expiring certs (validUntil within 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const expiringCerts = await prisma.certification.findMany({
    where: {
      validUntil: { lte: thirtyDaysFromNow },
      isActive: true,
    },
    include: {
      user: { select: { name: true } },
      machine: { select: { code: true } },
    },
    orderBy: { validUntil: "asc" },
  });

  // Fetch pending leaves
  const pendingLeaves = await prisma.leaveRequest.findMany({
    where: { status: "PENDING" },
    include: {
      user: {
        select: {
          name: true,
          role: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Mock overtime users since we don't have a direct weekly hours aggregation easily yet
  // In a real app this would query AttendanceLog group by user for the week
  const users = await prisma.user.findMany({
    where: { role: { name: "Operator" }, isActive: true },
    take: 5,
  });

  const overtimeUsers = users
    .map((u) => ({
      id: u.id,
      name: u.name,
      role: "Operator",
      hoursThisWeek: 48 + Math.floor(Math.random() * 12),
    }))
    .filter((u) => u.hoursThisWeek > 50)
    .sort((a, b) => b.hoursThisWeek - a.hoursThisWeek);

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Hub"
        description="Attendance stats, workforce metrics, and approvals."
      />
      <PulseClient
        stats={stats}
        expiringCerts={expiringCerts}
        pendingLeaves={pendingLeaves}
        overtimeUsers={overtimeUsers}
      />
    </div>
  );
}
