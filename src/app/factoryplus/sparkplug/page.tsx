import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import SparkplugClient from "./SparkplugClient";

export const metadata = {
  title: "MQTT Sparkplug B Node & Device Manager | Factory+",
  description:
    "AMRC Factory+ Report-by-Exception protocol: DBIRTH/DDEATH certificates, metric alias compression, and sequence integrity tracking",
};

export const dynamic = "force-dynamic";

export default async function SparkplugPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/factoryplus/sparkplug");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <SparkplugClient />;
}
