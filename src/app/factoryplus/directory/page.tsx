import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import DirectoryClient from "./DirectoryClient";

export const metadata = {
  title: "Factory+ Asset Directory & Device Catalog | Factory+",
  description:
    "Centralized UUID-indexed registry of Edge Gateways, CNC Machine Tools, CMM Metrology, and Sensors linked to standardized JSON schemas",
};

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/factoryplus/directory");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <DirectoryClient />;
}
