import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import PowderLogClient from "./PowderLogClient";

export const metadata = {
  title: "3D Metal Powder Lifecycle & Sieve Log | ManufacturingMax",
};

export default async function PowderLogPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/rnd/powder-log");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PowderLogClient />
    </div>
  );
}
