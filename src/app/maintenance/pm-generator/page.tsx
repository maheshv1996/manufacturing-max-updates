import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import PmGeneratorClient from "./PmGeneratorClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Spindle-Hour PM Auto-Generator | ManufacturingMax",
};

export default async function PmGeneratorPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/maintenance/pm-generator");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PmGeneratorClient />
    </div>
  );
}
