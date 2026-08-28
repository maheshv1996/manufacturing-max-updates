import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { ShieldCheck } from "lucide-react";
import PoApprovalsClient from "./PoApprovalsClient";

export const dynamic = "force-dynamic";

export default async function PoApprovalsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (
    !user ||
    (!user.isOwner && !canAny(user, ["supply.view", "commercial.view"]))
  ) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="PO Approval Chain"
        description="Two-tier approval — POs above ₹50,000 need a manager, above ₹5,00,000 need the owner. Receiving is blocked until approval."
        icon={<ShieldCheck className="h-5 w-5 text-amber-400" />}
      />
      <PoApprovalsClient />
    </div>
  );
}
