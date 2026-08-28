import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import QuotationsClient from "./QuotationsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function QuotationsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  // Only ADMIN and SUPERVISOR can access Sales & Quotations
  if (
    !user.isOwner &&
    !can(user, "system.edit") &&
    !user.isOwner &&
    !can(user, "ops.edit")
  ) {
    redirect("/");
  }

  const [products, settings] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    getSettings(),
  ]);

  return (
    <QuotationsClient
      products={JSON.parse(JSON.stringify(products))}
      branding={settings.branding}
      laborRatePerHour={settings.laborRatePerHour || 150}
      machineRatePerHour={settings.machineRatePerHour || 300}
    />
  );
}
