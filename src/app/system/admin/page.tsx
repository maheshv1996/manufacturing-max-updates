import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user.isOwner && !can(user, "system.edit")) {
    redirect("/");
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
          Admin Console
        </h1>
        <p className="text-slate-400">
          Manage master data for machines, users, products, and more.
        </p>
      </div>
      <AdminClient />
    </div>
  );
}
