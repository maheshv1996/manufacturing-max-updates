import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { Boxes } from "lucide-react";
import DeadStockClient from "./DeadStockClient";

export const dynamic = "force-dynamic";

export default async function DeadStockPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (
    !user ||
    (!user.isOwner && !canAny(user, ["supply.view", "finance.view"]))
  ) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dead Stock & Write-offs"
        description="Materials with no movement for 180+ days, valued at cost. Stores propose write-offs; finance approves and the stock ledger adjusts."
        icon={<Boxes className="h-5 w-5 text-rose-400" />}
      />
      <DeadStockClient />
    </div>
  );
}
