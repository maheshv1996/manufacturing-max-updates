import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import KioskClient from "./KioskClient";

export const metadata = {
  title: "Shopfloor Tablet Kiosk Mode | Operations",
  description:
    "Rugged touch terminal optimized for glove-operated tablets: 1-touch piece clocking, scrap logging, and Andon emergency calls",
};

export const dynamic = "force-dynamic";

export default async function KioskPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/ops/kiosk");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <KioskClient />;
}
