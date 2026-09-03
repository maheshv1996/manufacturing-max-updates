import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import SalesOrdersClient from "./SalesOrdersClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Sales Orders | ManufacturingMax",
};

export default async function SalesOrdersPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/commercial/sales-orders");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <SalesOrdersClient />
    </div>
  );
}