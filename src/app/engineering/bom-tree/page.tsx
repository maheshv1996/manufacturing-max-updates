import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import BomTreeClient from "./BomTreeClient";

export const metadata = {
  title: "Multi-Level BOM Tree & Cost Exploder | Engineering",
  description:
    "Interactive multi-level bill of materials hierarchy, raw material explosion and rollup costing",
};

export const dynamic = "force-dynamic";

export default async function BomTreePage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/engineering/bom-tree");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <BomTreeClient />;
}
