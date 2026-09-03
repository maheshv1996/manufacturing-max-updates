import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import HazWasteClient from "./HazWasteClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Hazardous Waste Manifests" };

export default async function Page() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/ehs/haz-waste");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <HazWasteClient />;
}
