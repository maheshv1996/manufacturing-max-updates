import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import BankingClient from "./BankingClient";

export const metadata = {
  title: "Bank Guarantees & Letters of Credit Tracker | ManufacturingMax",
};

export default async function BankingPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/finance/banking");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <BankingClient />
    </div>
  );
}
