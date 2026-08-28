import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, FileSignature } from "lucide-react";
import NewEcoModal from "./NewEcoModal";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EcoIndexPage() {
  const user = getUserFromHeaders(await headers());
  if (!can(user, "ops.view")) {
    redirect("/");
  }

  const ecos = await prisma.eco.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 lg:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-200 bg-slate-800/60 border border-slate-700 rounded-xl hover:bg-slate-800/90 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <NewEcoModal />
        </div>

        <header className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FileSignature className="w-6 h-6 text-amber-500" />
            Engineering Change Orders (ECO)
          </h1>
          <p className="text-slate-400 mt-2">
            Manage product revisions, BOM changes, and process updates through
            approval chains.
          </p>
        </header>

        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/60">
              <tr>
                <th className="p-3 font-semibold text-slate-400">ECO Number</th>
                <th className="p-3 font-semibold text-slate-400">Title</th>
                <th className="p-3 font-semibold text-slate-400">Status</th>
                <th className="p-3 font-semibold text-slate-400">
                  Effectivity
                </th>
                <th className="p-3 font-semibold text-slate-400 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800">
              {ecos.map((eco) => {
                let statusColor = "bg-slate-500/10 text-slate-300";
                if (eco.status === "APPROVED")
                  statusColor = "bg-blue-500/10 text-blue-300";
                if (eco.status === "IMPLEMENTED")
                  statusColor = "bg-emerald-500/10 text-emerald-300";
                if (eco.status === "REJECTED")
                  statusColor = "bg-rose-500/10 text-rose-300";

                return (
                  <tr key={eco.id} className="hover:bg-slate-800/90/50">
                    <td className="p-3 font-mono font-medium">
                      {eco.ecoNumber}
                    </td>
                    <td className="p-3 max-w-xs truncate" title={eco.title}>
                      {eco.title}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${statusColor}`}
                      >
                        {eco.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {eco.effectivityType === "DATE" ? "Date: " : "Serial: "}
                      <span className="font-mono">{eco.effectivityValue}</span>
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/eco/${eco.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {ecos.length === 0 && (
            <p className="text-center p-8 text-slate-500">No ECOs found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
