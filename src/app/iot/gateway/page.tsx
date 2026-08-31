import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import GatewayClient from "./GatewayClient";

export const metadata = {
  title: "MQTT / OPC-UA Edge Gateway & Ingestion | IIoT",
  description:
    "UMH Core edge daemon, Benthos streaming pipelines, and MQTT test payload injector",
};

export const dynamic = "force-dynamic";

export default async function GatewayPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/iot/gateway");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <GatewayClient />;
}
