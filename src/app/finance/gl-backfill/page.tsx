import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import GlBackfillClient from "./GlBackfillClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "GL Backfill Workbench | ManufacturingMax",
};

export default async function GlBackfillPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/finance/gl-backfill");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <GlBackfillClient />
    </div>
  );
}
