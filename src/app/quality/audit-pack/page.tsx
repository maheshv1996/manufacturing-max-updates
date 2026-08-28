import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import PrintButton from "@/app/components/print/PrintButton";
import { FileCheck2, CheckCircle2, AlertTriangle } from "lucide-react";
import { buildAuditPack } from "@/lib/auditPack";
import { format } from "date-fns";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function AuditPackPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user || (!user.isOwner && !can(user, "quality.view"))) {
    redirect("/login");
  }

  const pack = await buildAuditPack();

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Audit Readiness Pack"
          description="One-click dossier — calibration, training, NCR, 8D, PPAP, MRM and MSA registers with a coverage checklist."
          icon={<FileCheck2 className="h-5 w-5 text-emerald-500" />}
        >
          <PrintButton />
        </PageHeader>
      </div>

      {/* White-paper document (screen + print) */}
      <div className="bg-white text-slate-900 rounded-lg shadow-lg p-8 print:shadow-none print:rounded-none print:p-0 space-y-6">
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div>
            <div className="text-xl font-bold uppercase tracking-wide">
              Audit Readiness Dossier
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              ISO 9001:2015 / AS9100 — Register Coverage Checklist
            </div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div className="font-semibold text-sm text-slate-900">
              Manufacturing Max
            </div>
            <div>
              {format(new Date(pack.generatedAt), "dd MMM yyyy, HH:mm")}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="border border-slate-300 rounded-xl p-4">
            <p className="text-3xl font-black text-emerald-600">
              {pack.coverage.ok}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">
              Registers OK
            </p>
          </div>
          <div className="border border-slate-300 rounded-xl p-4">
            <p className="text-3xl font-black text-amber-600">
              {pack.coverage.attention}
            </p>
            <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">
              Need attention
            </p>
          </div>
          <div className="border border-slate-300 rounded-xl p-4">
            <p className="text-3xl font-black">{pack.coverage.total}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">
              Registers
            </p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-900 text-left">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Register / Record</th>
              <th className="py-2 pr-2">Clause</th>
              <th className="py-2 pr-2 text-right">Count</th>
              <th className="py-2 pr-2">Latest</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {pack.registers.map((r, i) => (
              <tr key={r.id} className="border-b border-slate-200">
                <td className="py-2 pr-2 text-slate-500">{i + 1}</td>
                <td className="py-2 pr-2 font-semibold">{r.title}</td>
                <td className="py-2 pr-2 text-xs text-slate-500">{r.clause}</td>
                <td className="py-2 pr-2 text-right font-bold">{r.count}</td>
                <td className="py-2 pr-2 text-xs text-slate-600">{r.latest}</td>
                <td className="py-2">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                      r.status === "OK"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {r.status === "OK" ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pack.coverage.attention > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm">
            <p className="font-bold text-amber-800 mb-1">
              Before the auditor walks in:
            </p>
            <ul className="list-disc pl-5 space-y-0.5 text-amber-800">
              {pack.registers
                .filter((r) => r.status !== "OK")
                .map((r) => (
                  <li key={r.id}>
                    {r.title} — {r.note}
                  </li>
                ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6 text-xs">
          <div>
            <p className="font-bold uppercase tracking-wide border-b border-slate-300 pb-1 mb-2">
              Calibration (latest {pack.calibration.length})
            </p>
            {pack.calibration.map((t) => (
              <p key={t.id} className="py-0.5">
                {t.name} · {t.serial} · cert {t.cert || "—"} · due {t.expires} ·{" "}
                <span
                  className={
                    t.status === "OK"
                      ? "text-emerald-700 font-bold"
                      : "text-rose-700 font-bold"
                  }
                >
                  {t.status}
                </span>
              </p>
            ))}
          </div>
          <div>
            <p className="font-bold uppercase tracking-wide border-b border-slate-300 pb-1 mb-2">
              Operator Training (latest {pack.training.length})
            </p>
            {pack.training.map((c) => (
              <p key={c.id} className="py-0.5">
                {c.machine} — certified by {c.certifiedBy} · {c.validFrom}
                {c.validUntil !== "—" ? ` → ${c.validUntil}` : ""}
              </p>
            ))}
          </div>
          <div>
            <p className="font-bold uppercase tracking-wide border-b border-slate-300 pb-1 mb-2">
              NCR Register (latest {pack.ncrs.length})
            </p>
            {pack.ncrs.map((n) => (
              <p key={n.id} className="py-0.5">
                {n.number} · {n.severity} ·{" "}
                <span
                  className={
                    n.status === "OPEN"
                      ? "text-rose-700 font-bold"
                      : "text-emerald-700 font-bold"
                  }
                >
                  {n.status}
                </span>{" "}
                · {n.raised}
              </p>
            ))}
          </div>
          <div>
            <p className="font-bold uppercase tracking-wide border-b border-slate-300 pb-1 mb-2">
              8D / CAPA (latest {pack.eightDs.length})
            </p>
            {pack.eightDs.map((e) => (
              <p key={e.id} className="py-0.5">
                {e.number} · {e.severity} · {e.status}
              </p>
            ))}
          </div>
          <div>
            <p className="font-bold uppercase tracking-wide border-b border-slate-300 pb-1 mb-2">
              PPAP Submissions (latest {pack.ppaps.length})
            </p>
            {pack.ppaps.map((p) => (
              <p key={p.id} className="py-0.5">
                {p.number} · {p.product} · {p.status}
              </p>
            ))}
          </div>
          <div>
            <p className="font-bold uppercase tracking-wide border-b border-slate-300 pb-1 mb-2">
              MRM Minutes (latest {pack.mrms.length})
            </p>
            {pack.mrms.map((m) => (
              <p key={m.id} className="py-0.5">
                {m.number} · {m.date} · {m.status}
              </p>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-slate-500 border-t border-slate-300 pt-3">
          Dossier generated automatically from live registers on{" "}
          {format(new Date(pack.generatedAt), "dd MMM yyyy HH:mm")}. Status =
          register health: OK (no open items / in-window) or ATTENTION (open
          NCRs, expiring calibration, empty registers).
        </p>
      </div>
    </div>
  );
}
