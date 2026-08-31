import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import CarbonClient from "./CarbonClient";

export const metadata = {
  title: "EU CBAM & ESG Embodied Carbon Calculator | ManufacturingMax",
};

export default async function CarbonPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/ehs/carbon");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <CarbonClient />
    </div>
  );
}
