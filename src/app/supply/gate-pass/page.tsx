import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { ShieldCheck } from "lucide-react";
import GatePassClient from "./GatePassClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function GatePassPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "supply.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Gate Pass — Dispatch Control"
        description="No dispatch leaves the gate without vehicle, driver and e-way bill number — printable gate pass per dispatch."
        icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />}
      />
      <GatePassClient />
    </div>
  );
}
