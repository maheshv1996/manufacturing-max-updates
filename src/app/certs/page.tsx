import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  ExternalLink,
} from "lucide-react";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function certTypeLabel(t: string) {
  if (t === "MILL_CERT") return "Mill Cert";
  if (t === "COC") return "CoC";
  if (t === "TEST_REPORT") return "Test Report";
  return t;
}

function certTypeColor(t: string) {
  if (t === "MILL_CERT")
    return "bg-blue-100 text-blue-700 dark:bg-blue-950 text-blue-300";
  if (t === "COC")
    return "bg-violet-100 text-violet-700 dark:bg-violet-950 text-violet-300";
  return "bg-slate-800/60 text-slate-300";
}

export default async function CertsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/certs");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const settings = await getSettings();

  const certs = await (prisma as any).materialCert.findMany({
    include: {
      inventoryTransaction: {
        select: { id: true, at: true, batchNo: true, qty: true },
      },
      rawMaterial: {
        select: { id: true, name: true, sku: true, unit: true },
      },
      supplier: {
        select: { id: true, name: true },
      },
    },
    orderBy: { uploadedAt: "desc" },
  });

  const expiringSoon = certs.filter(
    (c: any) =>
      c.expiresAt &&
      new Date(c.expiresAt) <= in30Days &&
      new Date(c.expiresAt) >= now,
  );

  const expired = certs.filter(
    (c: any) => c.expiresAt && new Date(c.expiresAt) < now,
  );

  // Count uncertified IN batches
  const uncertifiedCount = await (prisma as any).inventoryTransaction.count({
    where: { type: "IN", materialCert: null },
  });

  return (
    <main className="max-w-7xl mx-auto px-6 py-10 space-y-8 font-sans">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-400 rounded-2xl border border-amber-200 dark:border-amber-800">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">
              Mill Certs & Heat-Number Registry
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {settings.requireMillCerts
                ? "✈ Aerospace Mode ACTIVE — No cert, no metal."
                : "General mode — certs are optional."}
            </p>
          </div>
        </div>
        <Link
          href="/reports/material-certs"
          className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
        >
          <FileText className="w-4 h-4" />
          Print Register
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Certs", value: certs.length, color: "emerald" },
          {
            label: "Expiring < 30 Days",
            value: expiringSoon.length,
            color: expiringSoon.length > 0 ? "amber" : "slate",
          },
          {
            label: "Expired",
            value: expired.length,
            color: expired.length > 0 ? "rose" : "slate",
          },
          {
            label: "Uncertified Batches",
            value: uncertifiedCount,
            color:
              uncertifiedCount > 0 && settings.requireMillCerts
                ? "rose"
                : "slate",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`bg-slate-800/60 border rounded-2xl p-5 shadow-sm ${
              stat.color === "rose"
                ? "border-rose-200 dark:border-rose-900"
                : stat.color === "amber"
                  ? "border-amber-200 dark:border-amber-900"
                  : stat.color === "emerald"
                    ? "border-emerald-200 dark:border-emerald-900"
                    : "border-slate-700"
            }`}
          >
            <p className="text-3xl font-black text-white">{stat.value}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Expiring soon banner */}
      {expiringSoon.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-sm font-extrabold text-amber-300">
              ⚠ {expiringSoon.length} Cert(s) Expiring Within 30 Days
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {expiringSoon.map((c: any) => {
              const daysLeft = Math.ceil(
                (new Date(c.expiresAt).getTime() - now.getTime()) /
                  (1000 * 60 * 60 * 24),
              );
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/60 rounded-xl text-xs font-bold text-amber-200 animate-pulse"
                >
                  <span className="font-mono">{c.heatNumber}</span>
                  <span className="text-amber-500">·</span>
                  <span>{c.rawMaterial?.name}</span>
                  <span className="text-amber-500">·</span>
                  <span>{daysLeft}d left</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Uncertified batches warning */}
      {uncertifiedCount > 0 && settings.requireMillCerts && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-sm font-bold text-rose-300">
            🔴 {uncertifiedCount} uncertified IN batch(es) detected. Issuance
            is BLOCKED for these materials until certs are attached.
          </p>
        </div>
      )}

      {/* Cert Registry Table */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm overflow-x-auto">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-extrabold text-white">
            Certificate Registry
          </h2>
          <span className="ml-auto text-xs text-slate-400">
            {certs.length} records
          </span>
        </div>

        {certs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No mill certs on file yet.</p>
            <p className="text-xs mt-1">
              Receive stock with a heat number to attach a cert.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-bold">
              <tr>
                <th className="p-4">Heat Number</th>
                <th className="p-4">Cert Number</th>
                <th className="p-4">Material</th>
                <th className="p-4">Supplier</th>
                <th className="p-4">Type</th>
                <th className="p-4">Spec / Grade</th>
                <th className="p-4">Received</th>
                <th className="p-4">Expiry</th>
                <th className="p-4 text-center">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800 font-mono">
              {certs.map((cert: any) => {
                const isExpired =
                  cert.expiresAt && new Date(cert.expiresAt) < now;
                const isExpiring =
                  cert.expiresAt &&
                  !isExpired &&
                  new Date(cert.expiresAt) <= in30Days;

                return (
                  <tr
                    key={cert.id}
                    className={`hover:bg-slate-800/90/40 ${
                      isExpired ? "bg-rose-50/30 dark:bg-rose-950/20" : ""
                    }`}
                  >
                    <td className="p-4 font-extrabold text-emerald-400 text-sm">
                      {cert.heatNumber}
                    </td>
                    <td className="p-4 text-slate-600 text-slate-300">
                      {cert.certNumber || "—"}
                    </td>
                    <td className="p-4 font-sans">
                      <p className="font-bold text-white">
                        {cert.rawMaterial?.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {cert.rawMaterial?.sku}
                      </p>
                    </td>
                    <td className="p-4 font-sans text-slate-600 text-slate-300">
                      {cert.supplier?.name || "—"}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${certTypeColor(
                          cert.certType,
                        )}`}
                      >
                        {certTypeLabel(cert.certType)}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400">
                      {cert.specGrade || "—"}
                    </td>
                    <td className="p-4 text-slate-400">
                      {new Date(cert.uploadedAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      {cert.expiresAt ? (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isExpired
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950 text-rose-300"
                              : isExpiring
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 text-amber-300 animate-pulse"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 text-emerald-300"
                          }`}
                        >
                          {new Date(cert.expiresAt).toLocaleDateString()}
                          {isExpired
                            ? " EXPIRED"
                            : isExpiring
                              ? " ⚠ SOON"
                              : ""}
                        </span>
                      ) : (
                        <span className="text-slate-400">No expiry</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {cert.fileData ? (
                        <a
                          href={`/api/certs/${cert.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-950 text-amber-300 rounded-lg text-[10px] font-bold hover:bg-amber-200 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[10px]">
                          No file
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
