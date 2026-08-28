import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import PrintButton from "@/app/components/print/PrintButton";
import MonthPicker from "./MonthPicker";
import {
  BadgeIndianRupee,
  Wrench,
  PackageX,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { computeCoQ, currentPeriod, periodLabel } from "@/lib/costOfQuality";
import { format } from "date-fns";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default async function CostOfQualityPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (
    !user ||
    (!user.isOwner && !can(user, "quality.view") && !can(user, "finance.view"))
  ) {
    redirect("/login");
  }

  const sp = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(sp.period || "")
    ? sp.period!
    : currentPeriod();
  const coq = await computeCoQ(period);

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const pctOfTotal =
    coq.totalCost > 0
      ? (x: number) => Math.round((x / coq.totalCost) * 100)
      : () => 0;
  const rows: {
    label: string;
    value: number;
    detail: string;
    icon: any;
    bar: string;
    tone: string;
  }[] = [
    {
      label: "Scrap (internal failure)",
      value: coq.scrapCost,
      detail: `${coq.scrapUnits.toLocaleString()} units rejected`,
      icon: <PackageX className="h-4 w-4" />,
      bar: "bg-rose-500",
      tone: "text-rose-400",
    },
    {
      label: "Rework",
      value: coq.reworkCost,
      detail: `${coq.reworkUnits.toLocaleString()} units reworked`,
      icon: <RefreshCw className="h-4 w-4" />,
      bar: "bg-amber-500",
      tone: "text-amber-400",
    },
    {
      label: "Calibration",
      value: coq.calibrationCost,
      detail: `${coq.calibrationCount} instruments calibrated`,
      icon: <Wrench className="h-4 w-4" />,
      bar: "bg-sky-500",
      tone: "text-sky-400",
    },
    {
      label: "Warranty / customer claims",
      value: coq.warrantyCost,
      detail: `${coq.warrantyClaims} claims`,
      icon: <ShieldAlert className="h-4 w-4" />,
      bar: "bg-violet-500",
      tone: "text-violet-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Cost of Quality"
          description="Monthly quality-related costs — scrap, rework, calibration and warranty — computed live from app records."
          icon={<BadgeIndianRupee className="h-5 w-5 text-emerald-500" />}
        >
          <div className="flex items-center gap-2">
            <MonthPicker periods={months} current={period} />
            <PrintButton />
          </div>
        </PageHeader>
      </div>

      {/* White-paper document (screen + print) */}
      <div className="bg-white text-slate-900 rounded-lg shadow-lg p-8 print:shadow-none print:rounded-none print:p-0 space-y-6">
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div>
            <div className="text-xl font-bold uppercase tracking-wide">
              Cost of Quality Report
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              Scrap · Rework · Calibration · Warranty — {periodLabel(period)}
            </div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div className="font-semibold text-sm text-slate-900">
              Manufacturing Max
            </div>
            <div>{format(new Date(), "dd MMM yyyy")}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {rows.map((r) => (
            <div
              key={r.label}
              className="border border-slate-300 rounded-xl p-4"
            >
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                {r.label}
              </p>
              <p className="text-2xl font-black mt-1">{inr(r.value)}</p>
              <p className="text-[11px] text-slate-500 mt-1">{r.detail}</p>
            </div>
          ))}
          <div className="col-span-2 sm:col-span-4 border-t-2 border-slate-900 pt-3 flex items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-wide">
              Total Cost of Quality
            </span>
            <span className="text-3xl font-black">{inr(coq.totalCost)}</span>
          </div>
        </div>

        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-semibold flex items-center gap-2">
                  {r.icon} {r.label}
                </span>
                <span className={`font-black ${r.tone}`}>
                  {inr(r.value)} · {pctOfTotal(r.value)}%
                </span>
              </div>
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${r.bar} rounded-full`}
                  style={{ width: `${pctOfTotal(r.value)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-500 border-t border-slate-300 pt-3">
          Figures computed automatically: scrap & rework from production logs ×
          product unit cost; calibration from instrument cost records; warranty
          from customer complaints (returned qty × unit cost). Mirrored to the
          Finance hub.
        </p>
      </div>
    </div>
  );
}
