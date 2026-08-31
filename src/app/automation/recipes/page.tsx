import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import RecipesClient from "./RecipesClient";

export const metadata = {
  title: "Industrial Automation Recipe Catalog | Automation",
  description:
    "Pre-packaged edge recipes: Thermal runaway protection, ISO 10816 vibration quality gates, and milestone acoustic synths",
};

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/automation/recipes");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <RecipesClient />;
}
