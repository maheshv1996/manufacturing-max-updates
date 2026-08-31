import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import DepartmentsManagerClient from "./DepartmentsManagerClient";

export const metadata = {
  title: "Dynamic Department & Cell Architecture Studio | ManufacturingMax",
};

export default async function DepartmentsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/system/departments");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <DepartmentsManagerClient />
    </div>
  );
}
