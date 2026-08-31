import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LogsheetVerificationClient from "./LogsheetVerificationClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LogsheetVerificationPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "ops.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const sheets = await prisma.logsheet.findMany({
    include: {
      machine: { select: { id: true, code: true, name: true, plantId: true } },
      shift: true,
      operator: { select: { id: true, name: true, email: true } },
    },
    orderBy: { logDate: "desc" },
    take: 100,
  });

  const serializedSheets = sheets.map((s) => ({
    ...s,
    logDate: s.logDate.toISOString(),
    submittedAt: s.submittedAt?.toISOString() || null,
    verifiedAt: s.verifiedAt?.toISOString() || null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    entries: Array.isArray(s.entries) ? (s.entries as any[]) : [],
  }));

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <LogsheetVerificationClient initialSheets={serializedSheets as any} />
    </div>
  );
}
