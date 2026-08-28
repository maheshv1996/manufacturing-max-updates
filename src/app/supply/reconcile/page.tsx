import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import ReconcileClient from "./ReconcileClient";

export const metadata: Metadata = {
  title: "Shift Reconciliation | Manufacturing Max",
};

export default async function ReconcilePage() {
  const downtimeReasons = await prisma.downtimeReason.findMany({
    where: { isActive: true },
    orderBy: { category: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Shift Reconciliation
          </h1>
          <p className="text-slate-400 mt-1">
            Review and adjust drafted logs before finalizing the shift.
          </p>
        </div>
      </div>

      <ReconcileClient downtimeReasons={downtimeReasons} />
    </div>
  );
}
