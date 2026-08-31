import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import AnalystClient from "./AnalystClient";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function AnalystPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/analyst");
  if (!user || (!user.isOwner && requiredPerm && !can(user, requiredPerm))) {
    redirect("/login");
  }

  // Allow all roles, but data is scoped via getPlantScope

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Ask the Analyst
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Get instant answers to operational questions in plain language.
          </p>
        </div>
      </div>

      <AnalystClient />
    </div>
  );
}
