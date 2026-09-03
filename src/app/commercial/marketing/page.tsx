import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import MarketingClient from "./MarketingClient";
import { Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Marketing & Branding" };

export default async function MarketingPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/commercial/marketing");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl border bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30">
          <Megaphone className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Marketing & Branding</h1>
          <p className="text-sm text-slate-400">
            Campaign tracking with budgets, lead pipeline, and the public
            landing-page editor.
          </p>
        </div>
      </div>
      <MarketingClient />
    </div>
  );
}
