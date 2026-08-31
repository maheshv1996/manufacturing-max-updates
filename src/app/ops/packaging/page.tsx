import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import PackagingStation from "./PackagingStation";

export const metadata = {
  title: "Packaging Station | MES Operations",
  description:
    "Barcode scanning station for finished product packaging and shift tracking",
};

export const dynamic = "force-dynamic";

export default async function PackagingPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/ops/packaging");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <PackagingStation />;
}
