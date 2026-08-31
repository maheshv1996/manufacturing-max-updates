import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import TimeStudyClient from "./TimeStudyClient";
import { Timer } from "lucide-react";

export const metadata = { title: "Time Study (Industrial Engineering)" };

export default async function TimeStudyPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/ops/time-study");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl border bg-blue-500/10 text-blue-400 border-blue-500/30">
          <Timer className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            Time Study & Standard Times
          </h1>
          <p className="text-sm text-slate-400">
            Industrial Engineering — SAM capture per operation with live
            variance against actual shop-floor performance.
          </p>
        </div>
      </div>
      <TimeStudyClient />
    </div>
  );
}
