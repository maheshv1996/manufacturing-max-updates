import { headers } from "next/headers";
import { getUserFromHeaders, canAny } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import { Ship } from "lucide-react";
import EximClient from "./EximClient";

export const dynamic = "force-dynamic";

export default async function EximPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (
    !user ||
    (!user.isOwner && !canAny(user, ["commercial.view", "commercial.edit"]))
  ) {
    redirect("/login");
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="EXIM & Export Shipments"
        description="Shipment register with milestone tracking — booking → vessel → customs → arrival — and the CI / PL / CoO / BL document checklist."
        icon={<Ship className="h-5 w-5 text-sky-400" />}
      />
      <EximClient />
    </div>
  );
}
