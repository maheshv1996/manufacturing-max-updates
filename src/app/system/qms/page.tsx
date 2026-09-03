import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import QmsClient from "./QmsClient";
import { ClipboardCheck } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "QMS Internal Audits" };

export default async function QmsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/system/qms");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl border bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
          <ClipboardCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">QMS Internal Audits</h1>
          <p className="text-sm text-slate-400">
            ISO 9001 / AS9100 audit schedule, clause-based findings with
            severity, and corrective actions linked to NCRs.
          </p>
        </div>
      </div>
      <QmsClient />
    </div>
  );
}
