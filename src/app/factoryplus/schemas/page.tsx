import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import SchemasClient from "./SchemasClient";

export const metadata = {
  title: "Industrial Schema Validator & Metric Registry | Factory+",
  description:
    "Official AMRC Factory+ JSON Schema repository: Standardized metrics for CNC Milling, CMM Metrology, and Cleanrooms with live validation",
};

export const dynamic = "force-dynamic";

export default async function SchemasPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/factoryplus/schemas");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <SchemasClient />;
}
