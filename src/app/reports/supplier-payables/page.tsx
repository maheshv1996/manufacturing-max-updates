export const maxDuration = 60;
import { prisma } from "@/lib/prisma";
import SupplierPayablesClient from "./SupplierPayablesClient";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SupplierPayablesReportPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user || (!user.isOwner && !can(user, "reports.print"))) {
    redirect("/login");
  }

  const suppliers = await prisma.supplier.findMany({
    include: {
      purchaseOrders: {
        where: { status: "RECEIVED" },
      },
      payments: {
        orderBy: { paymentDate: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const supplierBalances = suppliers.map((s) => {
    const purchasedValue = s.purchaseOrders.reduce(
      (sum, po) => sum + po.receivedQty * po.unitCost,
      0,
    );
    const paidValue = s.payments.reduce((sum, p) => sum + p.amount, 0);
    const balancePayable = purchasedValue - paidValue;

    return {
      id: s.id,
      name: s.name,
      code: s.code,
      purchasedValue,
      paidValue,
      balancePayable,
      lastPaymentDate: s.payments.length > 0 ? s.payments[0].paymentDate : null,
      payments: s.payments,
    };
  });

  const settings = await getSettings();

  return (
    <SupplierPayablesClient
      suppliers={supplierBalances}
      branding={settings.branding}
    />
  );
}
