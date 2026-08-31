import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import AiSettingsClient from "./AiSettingsClient";

export const metadata = {
  title: "Free AI & LLM Engine Studio | ManufacturingMax",
};

export default async function AiSettingsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/system/ai");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <AiSettingsClient />
    </div>
  );
}
