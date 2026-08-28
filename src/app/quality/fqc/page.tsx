import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { Ruler } from "lucide-react";
import FqcClient from "./FqcClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function FqcPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "quality.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Final QC — Dispatch Checklist"
        description="Final inspection + packing + doc pack sign-offs. Nothing dispatches without all three AND a released data package — the gate blocks at the gate."
        icon={<Ruler className="h-5 w-5 text-emerald-500" />}
      />
      <FqcClient />
    </div>
  );
}
