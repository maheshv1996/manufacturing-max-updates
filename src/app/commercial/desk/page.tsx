import PageHeader from "@/app/components/shared/PageHeader";
import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CommercialDeskClient from "./CommercialDeskClient";

export const dynamic = "force-dynamic";

export default async function CommercialDesk() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user || (!user.isOwner && !can(user, "commercial.view"))) {
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

  const canEdit = user.isOwner || can(user, "commercial.edit");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commercial Desk"
        description="Accounts Payable, Receivables, and Financial Overview."
      />
      <CommercialDeskClient suppliers={supplierBalances} canEdit={canEdit} />
    </div>
  );
}
