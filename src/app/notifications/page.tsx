import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import NotificationsClient from "./NotificationsClient";
import { Bell } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Notifications Center" };

export default async function NotificationsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/notifications");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl border bg-amber-500/10 text-amber-400 border-amber-500/30">
          <Bell className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Notifications Center</h1>
          <p className="text-sm text-slate-400">
            Live action items across HR, supply, maintenance, commercial and
            compliance — acknowledge to clear.
          </p>
        </div>
      </div>
      <NotificationsClient />
    </div>
  );
}
