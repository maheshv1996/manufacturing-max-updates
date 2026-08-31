import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import UnsExplorerClient from "./UnsExplorerClient";

export const metadata = {
  title: "ISA-95 Unified Namespace (UNS) Live Explorer | IIoT",
  description:
    "Standardized industrial IoT topic tree, MQTT edge topics, and real-time process value inspector",
};

export const dynamic = "force-dynamic";

export default async function UnsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/iot/uns");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <UnsExplorerClient />;
}
