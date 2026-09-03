import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import GlRepairClient from "./GlRepairClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "GL Auto-Post Repair | ManufacturingMax",
};

export default async function GlRepairPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/finance/gl-repair");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <GlRepairClient />
    </div>
  );
}
