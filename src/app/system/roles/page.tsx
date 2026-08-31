import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import RolesMatrixClient from "./RolesMatrixClient";

export const metadata = {
  title: "Custom Departments & Role Permission Matrix | ManufacturingMax",
};

export default async function RolesMatrixPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/system/roles");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <RolesMatrixClient />
    </div>
  );
}
