import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import SubcontractingClient from "./SubcontractingClient";

export const metadata = {
  title: "Subcontracting & Special Process Outsourcing | Supply Chain",
  description:
    "Manage special process vendor delivery challans (Heat Treatment, Anodizing, Plating, NDT) and inward QC verification",
};

export const dynamic = "force-dynamic";

export default async function SubcontractingPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/supply/subcontracting");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <SubcontractingClient />;
}
