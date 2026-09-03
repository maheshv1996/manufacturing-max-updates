import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import CoolantClient from "./CoolantClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "CNC Coolant Refractometer & Sump Health | ManufacturingMax",
};

export default async function CoolantPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/maintenance/coolant");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <CoolantClient />
    </div>
  );
}
