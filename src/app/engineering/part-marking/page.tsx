import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import PartMarkingClient from "./PartMarkingClient";

export const metadata = {
  title: "2D DataMatrix Laser Marking Generator | ManufacturingMax",
};

export default async function PartMarkingPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/engineering/part-marking");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PartMarkingClient />
    </div>
  );
}
