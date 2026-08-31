import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/app/components/print/PrintButton";
import { FileWarning } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";

export const dynamic = "force-dynamic";

const TONE = {
  1: {
    title: "FIRST REMINDER",
    tone: "text-slate-900",
    border: "border-slate-900",
    body: "Our records show that the amount below is now due and payable. We kindly request you to arrange payment at the earliest so we can keep our mutual account current. If payment has already been made, please treat this letter as a reminder only and share the payment reference.",
  },
  2: {
    title: "SECOND NOTICE — FIRM DEMAND",
    tone: "text-orange-700",
    border: "border-orange-700",
    body: "Despite our earlier reminder, the amount below remains outstanding. We request you to settle this amount within 7 days of the date of this letter. Please note that continued non-payment will require us to escalate this account to our finance and legal teams for further action.",
  },
  3: {
    title: "FINAL NOTICE BEFORE LEGAL ACTION",
    tone: "text-rose-700",
    border: "border-rose-700",
    body: "This is our FINAL notice before the account is escalated for legal recovery. Unless the full amount below is received within 7 days, we will proceed with recovery proceedings, which may include interest, collection costs and legal charges, without further notice.",
  },
} as const;

export default async function DunningLetterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "commercial.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const { id } = await params;
  const account = await prisma.collectionAccount.findUnique({
    where: { id },
    include: { invoice: true, collector: { select: { name: true } } },
  });
  if (!account) notFound();

  const lvl = account.dunningLevel;
  const tone = TONE[(Math.min(lvl, 3) || 1) as 1 | 2 | 3];
  const inv = account.invoice;
  const outstanding = Number(inv.totalValue) - Number(inv.paidAmount || 0);
  const days = differenceInCalendarDays(
    new Date(),
    inv.dueDate ? new Date(inv.dueDate) : new Date(inv.invoiceDate),
  );
  const dt = (v: Date) =>
    v.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 font-sans print:p-0 print:max-w-full">
      <div className="flex items-center justify-between mb-6 print:mb-4">
        <div className="flex items-center gap-3">
          <FileWarning className="w-5 h-5 text-rose-400" />
          <h1 className="text-lg font-semibold text-slate-100">
            Dunning L{lvl} — {inv.invoiceNumber}
          </h1>
        </div>
        <PrintButton />
      </div>

      <div className="bg-white text-slate-900 rounded-lg shadow-lg p-8 print:shadow-none print:rounded-none print:p-0 space-y-6">
        {/* Letterhead */}
        <div
          className={`flex items-start justify-between border-b-2 ${tone.border} pb-4`}
        >
          <div>
            <div className="text-xl font-bold uppercase tracking-wide">
              Manufacturing Max
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              Private Limited · GSTIN 27ABCDE1234F1Z5
            </div>
            <div className="text-xs text-slate-600">
              Industrial Estate, Pune, Maharashtra — 411013
            </div>
          </div>
          <div className={`text-right font-bold ${tone.tone}`}>
            <div className="text-sm tracking-widest">{tone.title}</div>
            <div className="text-[11px] font-semibold text-slate-600 mt-1">
              DUN-{inv.invoiceNumber}-L{lvl}
            </div>
            <div className="text-[11px] font-semibold text-slate-600">
              {dt(new Date())}
            </div>
          </div>
        </div>

        {/* Addressee */}
        <div className="text-sm">
          <p>To,</p>
          <p className="font-bold text-base mt-1">{inv.customerName}</p>
          <p>
            {inv.customerAddress || inv.customerGstin
              ? (inv.customerAddress || "") +
                (inv.customerGstin ? ` · GSTIN ${inv.customerGstin}` : "")
              : ""}
          </p>
          {inv.customerGstin && !inv.customerAddress && (
            <p>GSTIN: {inv.customerGstin}</p>
          )}
        </div>

        <div className="text-sm leading-relaxed">
          <p>
            <span className="font-semibold">Subject: </span>Outstanding payment
            of{" "}
            <span className="font-bold">
              ₹{outstanding.toLocaleString("en-IN")}
            </span>{" "}
            against invoice{" "}
            <span className="font-bold">{inv.invoiceNumber}</span> —{" "}
            {days >= 0 ? `${days} days overdue` : "due shortly"}.
          </p>
          <p className="mt-3">{tone.body}</p>
        </div>

        {/* Amount table */}
        <table className="w-full text-sm border border-slate-300">
          <tbody>
            <tr className="border-b border-slate-300">
              <td className="px-3 py-2 font-semibold bg-slate-50">
                Invoice No.
              </td>
              <td className="px-3 py-2">{inv.invoiceNumber}</td>
              <td className="px-3 py-2 font-semibold bg-slate-50">
                Invoice date
              </td>
              <td className="px-3 py-2">{dt(inv.invoiceDate)}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="px-3 py-2 font-semibold bg-slate-50">
                Invoice total
              </td>
              <td className="px-3 py-2">
                ₹{Number(inv.totalValue).toLocaleString("en-IN")}
              </td>
              <td className="px-3 py-2 font-semibold bg-slate-50">Due date</td>
              <td className="px-3 py-2">
                {inv.dueDate ? dt(inv.dueDate) : "—"}
              </td>
            </tr>
            <tr className="border-b border-slate-300">
              <td className="px-3 py-2 font-semibold bg-slate-50">
                Amount paid
              </td>
              <td className="px-3 py-2">
                ₹{Number(inv.paidAmount || 0).toLocaleString("en-IN")}
              </td>
              <td className="px-3 py-2 font-semibold bg-slate-50">
                Days overdue
              </td>
              <td className="px-3 py-2">{days} days</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-bold bg-slate-100">
                AMOUNT OUTSTANDING
              </td>
              <td className={`px-3 py-2 font-bold ${tone.tone}`}>
                ₹{outstanding.toLocaleString("en-IN")}
              </td>
              <td className="px-3 py-2 font-semibold bg-slate-50">
                Handling by
              </td>
              <td className="px-3 py-2">
                {account.collector?.name || "Accounts"}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="text-sm leading-relaxed">
          <p>
            Payment may be made by bank transfer to our account (details
            available on request) or via the payment link on your portal. If
            this amount has already been settled, kindly share the payment
            reference for our records.
          </p>
          {lvl >= 2 && (
            <p className={`mt-2 font-semibold ${tone.tone}`}>
              {lvl === 2
                ? "Please note: if payment is not received within 7 days, a final notice will be issued."
                : "Please note: if payment is not received within 7 days, legal recovery proceedings will commence without further notice."}
            </p>
          )}
        </div>

        <div className="flex items-end justify-between pt-6 text-sm">
          <div>
            <p className="font-semibold">Accounts Receivable</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {account.collector?.name || "Manufacturing Max Pvt Ltd"}
            </p>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-500 pt-1 px-8 text-xs text-slate-600">
              Authorised Signatory
            </div>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 border-t border-slate-200 pt-2">
          This is a computer-generated dunning letter. Dunning reference DUN-
          {inv.invoiceNumber}-L{lvl} · Generated{" "}
          {new Date().toLocaleString("en-IN")}. For queries contact
          accounts@manufacturingmax.in.
        </p>
      </div>
    </main>
  );
}
