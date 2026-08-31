import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import GenealogyClient from "./GenealogyClient";

export const metadata = {
  title: "360° Serial & Lot Genealogy Traceability | Quality",
  description:
    "End-to-end upstream & downstream tracking: Raw Material Heat Lots, CNC Machining, Special Processes, FAI QC, and Customer Invoices",
};

export const dynamic = "force-dynamic";

export default async function GenealogyPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/quality/genealogy");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <GenealogyClient />;
}
