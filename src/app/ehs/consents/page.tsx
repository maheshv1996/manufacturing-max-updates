import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import ConsentsClient from "./ConsentsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Consent Renewals (Water / Air)" };

export default async function Page() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/ehs/consents");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <ConsentsClient />;
}
