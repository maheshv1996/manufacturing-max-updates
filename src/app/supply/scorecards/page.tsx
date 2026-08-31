import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import SupplierScorecardsClient from "./SupplierScorecardsClient";
import { Star } from "lucide-react";

export const metadata = { title: "Supplier Scorecards" };

export default async function SupplierScorecardsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/supply/scorecards");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl border bg-amber-500/10 text-amber-400 border-amber-500/30">
          <Star className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Supplier Scorecards</h1>
          <p className="text-sm text-slate-400">
            Quarterly supplier KPIs — OTD, quality PPM, cost variance and
            responsiveness — with a weighted overall grade.
          </p>
        </div>
      </div>
      <SupplierScorecardsClient />
    </div>
  );
}
