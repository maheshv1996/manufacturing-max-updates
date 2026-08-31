import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, PackageCheck } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DataPackageSelectPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "ops.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const workOrders = await prisma.workOrder.findMany({
    include: {
      product: true,
      dataPackages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 lg:p-8 text-slate-100">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/reports"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-200 bg-slate-800/60 border border-slate-700 rounded-xl hover:bg-slate-800/90 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reports
          </Link>
        </div>

        <header className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <PackageCheck className="w-6 h-6 text-indigo-500" />
            Select Work Order for Data Package
          </h1>
          <p className="text-slate-400 mt-2">
            Choose a work order below to view, generate, or release its Data
            Package (Birth Record).
          </p>
        </header>

        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/60">
              <tr>
                <th className="p-3 font-semibold text-slate-400">WO Number</th>
                <th className="p-3 font-semibold text-slate-400">Product</th>
                <th className="p-3 font-semibold text-slate-400">Status</th>
                <th className="p-3 font-semibold text-slate-400">
                  Package Status
                </th>
                <th className="p-3 font-semibold text-slate-400 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800">
              {workOrders.map((wo) => {
                const dp = wo.dataPackages[0];
                return (
                  <tr key={wo.id} className="hover:bg-slate-800/90/50">
                    <td className="p-3 font-mono font-medium">{wo.woNumber}</td>
                    <td className="p-3">
                      {wo.product?.name} ({wo.product?.sku})
                    </td>
                    <td className="p-3">{wo.status}</td>
                    <td className="p-3">
                      {dp ? (
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${dp.status === "RELEASED" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}
                        >
                          {dp.status}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {dp ? (
                        <Link
                          href={`/reports/data-package/${dp.id}`}
                          className="text-indigo-600 hover:underline"
                        >
                          View Dossier
                        </Link>
                      ) : (
                        <Link
                          href={`/ops/work-orders/${wo.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          Go to WO
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {workOrders.length === 0 && (
            <p className="text-center p-8 text-slate-500">
              No work orders found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
