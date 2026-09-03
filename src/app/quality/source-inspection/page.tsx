import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import SourceInspectionClient from "./SourceInspectionClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Defense & Customer Source Inspection Gate | ManufacturingMax",
};

export default async function SourceInspectionPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/quality/source-inspection");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <SourceInspectionClient />
    </div>
  );
}
