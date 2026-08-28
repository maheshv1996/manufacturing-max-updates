import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { Award } from "lucide-react";
import AppraisalsClient from "./AppraisalsClient";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function AppraisalsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "people.view"))) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Live-Data Appraisal"
        description="Operator score computed automatically from production (efficiency), quality (scrap rate) and attendance — managers add the rating and comments, then print."
        icon={<Award className="h-5 w-5 text-amber-500" />}
      />
      <AppraisalsClient />
    </div>
  );
}
