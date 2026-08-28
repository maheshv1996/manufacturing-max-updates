import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { Scale } from "lucide-react";
import ComparativeClient from "./ComparativeClient";

export const dynamic = "force-dynamic";

export default async function ComparativePage() {
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
        title="Comparative Statements"
        description="Multi-supplier rate comparison — collect quotes per material, then award the best rate, which raises the PO through the approval chain."
        icon={<Scale className="h-5 w-5 text-amber-400" />}
      />
      <ComparativeClient />
    </div>
  );
}
