import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { ShieldCheck } from "lucide-react";
import VouchersClient from "./VouchersClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function VouchersPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "finance.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vouchers — Maker Checker"
        description="M17: the maker enters a voucher, a manager checks and posts it. An unchecked voucher has zero effect on the books — nothing posts itself."
        icon={<ShieldCheck className="h-5 w-5 text-indigo-400" />}
      />
      <VouchersClient />
    </div>
  );
}
