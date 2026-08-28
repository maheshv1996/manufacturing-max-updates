import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { Users } from "lucide-react";
import BuyerBoardClient from "./BuyerBoardClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function BuyerBoardPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "supply.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Buyer Board"
        description="Managers assign open requisitions to buyers; buyers log PO follow-ups; overdue POs ping the bell."
        icon={<Users className="h-5 w-5 text-amber-500" />}
      />
      <BuyerBoardClient />
    </div>
  );
}
