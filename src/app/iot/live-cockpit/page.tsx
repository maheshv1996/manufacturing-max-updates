import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import LiveCockpitClient from "./LiveCockpitClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Real-Time Telemetry Cockpit | ManufacturingMax",
};

export default async function LiveCockpitPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/iot/live-cockpit");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <LiveCockpitClient />
    </div>
  );
}
