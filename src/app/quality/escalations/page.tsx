import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import NcrEscalationsClient from "./NcrEscalationsClient";

export const metadata = {
  title: "NCR Auto-Escalation & 8D Sentinel | ManufacturingMax",
};

export default async function EscalationsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/quality/escalations");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <NcrEscalationsClient />
    </div>
  );
}
