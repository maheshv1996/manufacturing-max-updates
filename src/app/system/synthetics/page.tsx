import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import SyntheticsClient from "./SyntheticsClient";

export const metadata = {
  title: "Synthetic Pipeline Tester | System",
  description:
    "Continuous integration test runner executing automated 7-stage factory cycles: BOM Explosion → MRP → Work Orders → Kiosk → Subcontracting → AS9102 FAI → Job Costing",
};

export const dynamic = "force-dynamic";

export default async function SyntheticsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/system/synthetics");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <SyntheticsClient />;
}
