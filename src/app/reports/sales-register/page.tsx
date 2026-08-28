import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import SalesRegisterClient from "./SalesRegisterClient";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 0;

export default async function SalesRegisterPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (
    !user.isOwner &&
    !can(user, "system.edit") &&
    !user.isOwner &&
    !can(user, "ops.edit")
  ) {
    redirect("/");
  }

  const [invoices, settings] = await Promise.all([
    (prisma as any).invoice.findMany({
      orderBy: { createdAt: "desc" },
    }),
    getSettings(),
  ]);

  return (
    <SalesRegisterClient
      invoices={JSON.parse(JSON.stringify(invoices))}
      branding={settings.branding}
    />
  );
}
