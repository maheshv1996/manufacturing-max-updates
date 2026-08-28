import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, FileSignature, CheckCircle } from "lucide-react";
import EcoActions from "./EcoActions";
import AddEcoItemModal from "./AddEcoItemModal";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EcoDetailPage(props: any) {
  const params = await props.params;
  const user = getUserFromHeaders(await headers());
  if (!can(user, "ops.view")) {
    redirect("/");
  }
  const { id } = await params;

  const eco = await prisma.eco.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!eco) notFound();

  // We need products for the AddEcoItemModal
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 lg:p-8 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/eco"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-200 bg-slate-800/60 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to ECO List
          </Link>
          <EcoActions eco={eco} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <header className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-3">
                    <FileSignature className="w-6 h-6 text-indigo-500" />
                    {eco.ecoNumber}
                  </h1>
                  <h2 className="text-lg font-medium mt-1">{eco.title}</h2>
                  <p className="text-slate-400 mt-4 whitespace-pre-wrap">
                    {eco.description}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-bold ${
                    eco.status === "APPROVED"
                      ? "bg-blue-500/10 text-blue-300"
                      : eco.status === "IMPLEMENTED"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : eco.status === "REJECTED"
                          ? "bg-rose-500/10 text-rose-300"
                          : "bg-slate-500/10 text-slate-300"
                  }`}
                >
                  {eco.status}
                </span>
              </div>
            </header>

            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Change Items</h3>
                {eco.status === "DRAFT" && (
                  <AddEcoItemModal ecoId={eco.id} products={products} />
                )}
              </div>

              {eco.items.length === 0 ? (
                <p className="text-slate-500 italic">
                  No change items added yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {eco.items.map((item) => (
                    <div
                      key={item.id}
                      className="border border-slate-700 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              item.action === "ADD"
                                ? "bg-emerald-500/10 text-emerald-300"
                                : item.action === "REMOVE"
                                  ? "bg-rose-500/10 text-rose-300"
                                  : "bg-amber-500/10 text-amber-300"
                            }`}
                          >
                            {item.action}
                          </span>
                          <span className="font-semibold">
                            {item.entityType}
                          </span>
                          <span className="text-slate-500 text-sm">
                            | Product:{" "}
                            {products.find((p) => p.id === item.productId)
                              ?.sku || item.productId}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                        {item.oldData && (
                          <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-600">
                            <div className="text-xs font-semibold text-slate-400 mb-1">
                              OLD DATA
                            </div>
                            <pre className="whitespace-pre-wrap font-mono text-xs">
                              {JSON.stringify(item.oldData, null, 2)}
                            </pre>
                          </div>
                        )}
                        {item.newData && (
                          <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-600">
                            <div className="text-xs font-semibold text-slate-400 mb-1">
                              NEW DATA
                            </div>
                            <pre className="whitespace-pre-wrap font-mono text-xs">
                              {JSON.stringify(item.newData, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-sm mt-3 text-slate-300">
                          Notes: {item.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-lg mb-4">Details</h3>

              <div>
                <p className="text-sm text-slate-400">Raised By</p>
                <p className="font-medium">{eco.raisedBy}</p>
              </div>

              <div>
                <p className="text-sm text-slate-400">Effectivity</p>
                <p className="font-medium">
                  {eco.effectivityType === "DATE" ? "Date: " : "Serial: "}{" "}
                  {eco.effectivityValue}
                </p>
              </div>

              <hr className="border-slate-700" />

              <div>
                <p className="text-sm text-slate-400">Created</p>
                <p className="font-medium">
                  {new Date(eco.createdAt).toLocaleString()}
                </p>
              </div>

              {eco.approvedAt && (
                <div>
                  <p className="text-sm text-slate-400">Approved By</p>
                  <p className="font-medium flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />{" "}
                    {eco.approvedBy}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(eco.approvedAt).toLocaleString()}
                  </p>
                </div>
              )}

              {eco.implementedAt && (
                <div>
                  <p className="text-sm text-slate-400">Implemented</p>
                  <p className="font-medium flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-emerald-500" /> System
                    Engine
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(eco.implementedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
