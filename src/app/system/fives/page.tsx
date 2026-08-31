import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import FiveSClient from "./FiveSClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FiveSPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/system/fives");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-6">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              5S Audits &amp; Visual Workplace Rankings
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Digital Lean 5S audits (Sort, Set in Order, Shine, Standardize,
              Sustain) with live scoring and area leaderboards.
            </p>
          </div>
        </header>

        <FiveSClient />
      </div>
    </div>
  );
}
