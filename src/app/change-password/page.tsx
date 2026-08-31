import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders } from "@/lib/permissions";
import ChangePasswordClient from "./ChangePasswordClient";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user) {
    redirect("/login");
  }

  return <ChangePasswordClient />;
}
