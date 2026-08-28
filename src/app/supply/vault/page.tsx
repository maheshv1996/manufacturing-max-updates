import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import VaultClient from "./VaultClient";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function SupplyVault() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user || (!user.isOwner && !can(user, "supply.view"))) {
    redirect("/login");
  }

  // Fetch materials & inventory in parallel
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [materials, todaysTransactions, recentTransactions] = await Promise.all(
    [
      prisma.rawMaterial.findMany({
        where: { isActive: true },
      }),
      prisma.inventoryTransaction.findMany({
        where: {
          at: { gte: today },
        },
      }),
      prisma.inventoryTransaction.findMany({
        take: 10,
        orderBy: { at: "desc" },
        include: {
          rawMaterial: true,
          workOrder: true,
        },
      }),
    ],
  );

  const totalValuation = materials.reduce(
    (acc, item) => acc + item.currentStock * item.unitCost,
    0,
  );
  const lowStockItems = materials.filter(
    (item) => item.currentStock <= item.minStock,
  );

  const inwardToday = todaysTransactions.filter(
    (tx) => tx.type === "IN",
  ).length;
  const outwardToday = todaysTransactions.filter(
    (tx) => tx.type === "OUT",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Hub"
        description="Stock valuation and supply chain alerts."
      />
      <VaultClient
        totalValuation={totalValuation}
        lowStockItems={lowStockItems}
        inwardToday={inwardToday}
        outwardToday={outwardToday}
        recentTransactions={recentTransactions}
      />
    </div>
  );
}
