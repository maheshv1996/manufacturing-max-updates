import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import IntegrationsClient from "./IntegrationsClient";

export const metadata = {
  title: "External Integrations Hub | ManufacturingMax",
};

export default async function IntegrationsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/system/integrations");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <IntegrationsClient />
    </div>
  );
}
