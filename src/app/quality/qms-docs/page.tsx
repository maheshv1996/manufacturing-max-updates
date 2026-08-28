import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { ClipboardList } from "lucide-react";
import QmsDocsClient from "./QmsDocsClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function QmsDocsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "quality.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Control — QMS"
        description="ISO 9001 document registry with annual review tracking. Documents due within 30 days or overdue surface in the morning digest."
        icon={<ClipboardList className="h-5 w-5 text-emerald-500" />}
      />
      <QmsDocsClient />
    </div>
  );
}
