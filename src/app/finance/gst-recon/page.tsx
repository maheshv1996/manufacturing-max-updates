import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { Scale } from "lucide-react";
import GstReconClient from "./GstReconClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function GstReconPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "finance.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="GST Reconciliation"
        description="M18: upload a GSTR-2B-style CSV, match it against the purchase register (GSTIN + invoice + amount), and work the mismatch follow-up list until the period closes."
        icon={<Scale className="h-5 w-5 text-emerald-400" />}
      />
      <GstReconClient />
    </div>
  );
}
