import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { CalendarDays } from "lucide-react";
import YearPicker from "./YearPicker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const LEGEND: { label: string; cls: string }[] = [
  { label: "Audits", cls: "bg-indigo-500" },
  { label: "Calibration due", cls: "bg-teal-500" },
  { label: "Calibration overdue", cls: "bg-rose-600" },
  { label: "PM jobs", cls: "bg-emerald-500" },
  { label: "PF/ESI challan", cls: "bg-orange-500" },
  { label: "GST return", cls: "bg-sky-500" },
];

export default async function QualityCalendarReport(props: {
  searchParams?: Promise<{ year?: string }>;
}) {
  const searchParams = await props.searchParams;
  const year = Number(searchParams?.year) || new Date().getFullYear();
  const now = new Date();

  const inYear = (d: Date) => d.getFullYear() === year;
  const monthOf = (d: Date) => d.getMonth();

  const [audits, tools, pmJobs, statutoryRows, invoices] = await Promise.all([
    prisma.qmsAudit.findMany({ orderBy: { scheduledDate: "asc" } }),
    prisma.calibratedTool.findMany({ orderBy: { name: "asc" } }),
    (prisma as any).maintenanceJob.findMany({
      where: { type: "PM" },
      include: { machine: { select: { name: true, code: true } } },
      orderBy: { openedAt: "asc" },
    }),
    (prisma as any).statutoryContribution.findMany({
      select: { month: true },
      distinct: ["month"],
    }),
    (prisma as any).invoice.findMany({ select: { invoiceDate: true } }),
  ]);

  const auditRows = audits.filter((a) => inYear(a.scheduledDate));
  const toolRows = tools.filter(
    (t) => inYear(t.expiresAt) || t.expiresAt < now,
  );
  const pmRows = pmJobs.filter((j: any) => inYear(j.openedAt));

  const statutoryMonths = statutoryRows
    .map((r: any) => r.month)
    .filter((m: string) => m.startsWith(String(year)))
    .sort();
  const gstMonths: string[] = Array.from(
    new Set<string>(
      invoices
        .map((i: any) => i.invoiceDate)
        .filter((d: Date | null) => d && inYear(d))
        .map(
          (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        ) as string[],
    ),
  ).sort();

  const monthIdx = (ym: string) => {
    const m = Number(ym.split("-")[1]);
    return m >= 1 && m <= 12 ? m - 1 : null;
  };

  const Cell = ({
    idx,
    cls,
    title,
  }: {
    idx: number | null;
    cls: string;
    title: string;
  }) =>
    idx === null ? (
      <td className="border border-slate-700 print:border-gray-200"></td>
    ) : (
      <td
        className={`border border-slate-700 print:border-gray-200 ${cls}`}
        title={title}
      ></td>
    );

  return (
    <main className="max-w-7xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-6 print:mb-4">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-7 h-7 text-indigo-600 print:hidden" />
          <div>
            <h1 className="text-2xl font-extrabold text-white print:text-black">
              Annual Quality Calendar â€” {year}
            </h1>
            <p className="text-xs text-slate-500 print:text-gray-600 mt-0.5">
              Audits Â· Calibration due dates Â· PM schedule Â· Statutory
              filings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <YearPicker year={year} />
          <PrintButton />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6 print:mb-4">
        {LEGEND.map((l) => (
          <span
            key={l.label}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 text-slate-300 print:text-gray-700"
          >
            <span className={`w-3 h-3 rounded ${l.cls}`} /> {l.label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto bg-slate-800/60 rounded-2xl border border-slate-700 shadow-sm print:shadow-none print:border print:border-gray-200 print:rounded-none">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-slate-800/60 print:bg-gray-100 text-left p-3 w-56">
                Item
              </th>
              {MONTHS.map((m) => (
                <th
                  key={m}
                  className="bg-slate-800/60 print:bg-gray-100 text-center p-2 font-bold text-slate-400 print:text-gray-600"
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 divide-slate-800 print:divide-gray-200">
            {/* AUDITS */}
            {auditRows.length === 0 && (
              <tr>
                <td className="p-3 text-slate-400 italic" colSpan={13}>
                  No scheduled audits in {year}.
                </td>
              </tr>
            )}
            {auditRows.map((a) => (
              <tr key={a.id}>
                <td className="p-3 font-semibold text-white print:text-black">
                  <span className="font-mono text-indigo-400">
                    {a.auditNumber}
                  </span>{" "}
                  Â· {a.title}
                </td>
                {MONTHS.map((_, i) => (
                  <Cell
                    key={i}
                    idx={monthOf(a.scheduledDate) === i ? i : null}
                    cls="bg-indigo-500/60 print:bg-gray-300"
                    title={`${a.auditNumber} â€” ${new Date(a.scheduledDate).toLocaleDateString()}`}
                  />
                ))}
              </tr>
            ))}

            {/* CALIBRATION */}
            {toolRows.map((t) => {
              const expired = t.expiresAt < now;
              return (
                <tr key={t.id}>
                  <td className="p-3 text-slate-300 print:text-gray-700">
                    <span className="font-semibold text-white print:text-black">
                      {t.name}
                    </span>{" "}
                    <span className="font-mono text-slate-400">
                      ({t.serialNumber})
                    </span>
                    {expired && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 text-[10px] font-bold print:bg-gray-200 print:text-black">
                        OVERDUE
                      </span>
                    )}
                  </td>
                  {MONTHS.map((_, i) => (
                    <Cell
                      key={i}
                      idx={monthOf(t.expiresAt) === i ? i : null}
                      cls={
                        expired
                          ? "bg-rose-600 print:bg-gray-300"
                          : "bg-teal-500/60 print:bg-gray-300"
                      }
                      title={`${t.serialNumber} expires ${new Date(t.expiresAt).toLocaleDateString()}`}
                    />
                  ))}
                </tr>
              );
            })}

            {/* PM JOBS */}
            {pmRows.map((j: any) => (
              <tr key={j.id}>
                <td className="p-3 text-slate-300 print:text-gray-700">
                  PM Â·{" "}
                  <span className="font-semibold text-white print:text-black">
                    {j.machine?.name || j.machine?.code || j.machineId}
                  </span>{" "}
                  Â· {j.priority}
                </td>
                {MONTHS.map((_, i) => (
                  <Cell
                    key={i}
                    idx={monthOf(j.openedAt) === i ? i : null}
                    cls="bg-emerald-500/60 print:bg-gray-300"
                    title={`PM ${j.machine?.name || ""} â€” ${new Date(j.openedAt).toLocaleDateString()}`}
                  />
                ))}
              </tr>
            ))}

            {/* STATUTORY â€” PF/ESI */}
            {statutoryMonths.map((ym: string) => {
              const idx = monthIdx(ym);
              return (
                <tr key={`pf-${ym}`}>
                  <td className="p-3 text-slate-300 print:text-gray-700">
                    PF/ESI Challan{" "}
                    <span className="font-mono text-slate-400">({ym})</span>
                  </td>
                  {MONTHS.map((_, i) => (
                    <Cell
                      key={i}
                      idx={idx === i ? i : null}
                      cls="bg-orange-500 print:bg-gray-300"
                      title={`PF/ESI challan ${ym}`}
                    />
                  ))}
                </tr>
              );
            })}

            {/* STATUTORY â€” GST */}
            {gstMonths.map((ym: string) => {
              const idx = monthIdx(ym);
              return (
                <tr key={`gst-${ym}`}>
                  <td className="p-3 text-slate-300 print:text-gray-700">
                    GST Return (GSTR-1){" "}
                    <span className="font-mono text-slate-400">({ym})</span>
                  </td>
                  {MONTHS.map((_, i) => (
                    <Cell
                      key={i}
                      idx={idx === i ? i : null}
                      cls="bg-sky-500 print:bg-gray-300"
                      title={`GST return ${ym}`}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 mt-6 print:mt-4 print:text-gray-400">
        Manufacturing MAX Â· Annual Quality Calendar Â· {year} Â· Audits,
        calibration, PM and statutory schedule Â· Confidential
      </p>
    </main>
  );
}
