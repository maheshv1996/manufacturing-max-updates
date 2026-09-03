import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import InsuranceClient from "./InsuranceClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Insurance Register | ManufacturingMax",
};

export default async function InsurancePage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/finance/insurance");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <InsuranceClient />
    </div>
  );
}
