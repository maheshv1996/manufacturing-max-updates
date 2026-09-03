import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import EscalationsClient from "./EscalationsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Escalations | Manufacturing Max",
};

export default async function EscalationsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/system/escalations");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white">Escalation Register</h1>
        <p className="text-sm text-slate-400 mt-1">
          Cross-functional escalations — quality, machine, delivery and people
          issues that need management attention. Open items surface in the
          executive dashboard and notifications.
        </p>
      </div>
      <EscalationsClient />
    </div>
  );
}
