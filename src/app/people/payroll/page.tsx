import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import PayrollClient from "./PayrollClient";
import { Wallet } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Payroll & Salary" };

export default async function PayrollPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/people/payroll");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
          <Wallet className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Payroll & Salary</h1>
          <p className="text-sm text-slate-400">
            Salary structures (CTC breakup) and monthly pay-slip generation with
            PF & professional-tax deductions.
          </p>
        </div>
      </div>
      <PayrollClient />
    </div>
  );
}
