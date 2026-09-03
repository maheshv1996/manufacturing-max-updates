import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import PlantTransfersClient from "./PlantTransfersClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Inter-Plant Stock Transfers | ManufacturingMax",
};

export default async function PlantTransfersPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/supply/plant-transfers");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PlantTransfersClient />
    </div>
  );
}
