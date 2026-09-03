import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import PyrometryClient from "./PyrometryClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Aerospace Furnace Pyrometry (AMS 2750G) | ManufacturingMax",
};

export default async function PyrometryPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/quality/pyrometry");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PyrometryClient />
    </div>
  );
}
