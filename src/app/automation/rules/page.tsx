import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import AutomationRulesClient from "./AutomationRulesClient";

export const metadata = {
  title: "Universal Multi-Domain Automation Rules | ManufacturingMax",
};

export default async function AutomationRulesPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/automation/rules");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <AutomationRulesClient />
    </div>
  );
}
