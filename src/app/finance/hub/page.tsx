import { headers } from "next/headers";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PageHeader from "@/app/components/shared/PageHeader";
import HubClient from "@/app/components/shared/HubClient";
import { prisma } from "@/lib/prisma";
import { fromPaiseRows } from "@/lib/money";
import {
  Calculator,
  DollarSign,
  PackageCheck,
  AlertTriangle,
  Wallet,
  PiggyBank,
  BadgeIndianRupee,
  ClipboardList,
  TrendingUp,
  BookOpen,
  FileText,
  CalendarRange,
  BarChart3,
  Receipt,
  ShieldAlert,
  Wrench,
  History,
} from "lucide-react";
import { format } from "date-fns";
import { computeCoQ } from "@/lib/costOfQuality";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function FinanceHub() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!user || (!user.isOwner && !can(user, "finance.view"))) {
    redirect("/login");
  }
  const now = new Date();
  const thisMonth = format(now, "yyyy-MM");

  const [invoices, supplierInvoices, treasury, payslips, budgetLines, coq] =
    await Promise.all([
      prisma.invoice.findMany({ orderBy: { invoiceDate: "desc" }, take: 200 }),
      prisma.supplierInvoice.findMany({
        orderBy: { invoiceDate: "desc" },
        take: 200,
        include: { supplier: true, grn: true },
      }),
      prisma.treasuryTransaction.findMany({
        orderBy: { date: "desc" },
        take: 200,
      }),
      prisma.payslip.findMany({ orderBy: { generatedAt: "desc" }, take: 100 }),
      prisma.budgetLine.findMany({ take: 100 }),
      computeCoQ(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      ),
    ]);
  // Ledger-style fixed point: invoice / supplier-invoice / treasury rows store
  // paise — map to the rupee contract before any KPI, feed or section display.
  const invoicesR = fromPaiseRows("Invoice", invoices);
  const supplierInvoicesR = fromPaiseRows("SupplierInvoice", supplierInvoices);
  const treasuryR = fromPaiseRows("TreasuryTransaction", treasury);

  const receivables = invoicesR.filter((i) => i.status !== "PAID");
  const receivablesTotal = receivables.reduce(
    (s, i) => s + (i.totalValue - i.paidAmount),
    0,
  );
  const payables = supplierInvoicesR.filter((i) => i.status === "UNPAID");
  const payablesTotal = payables.reduce((s, i) => s + i.totalAmount, 0);
  const mismatched = supplierInvoicesR.filter(
    (i) => i.grn?.matchStatus === "MISMATCHED",
  );
  const bankBalance = treasuryR.reduce(
    (s, t) => s + (t.type === "INFLOW" ? t.amount : -t.amount),
    0,
  );
  const monthPayroll = payslips
    .filter((p) => p.month === thisMonth)
    .reduce((s, p) => s + (p.netPay || 0), 0);
  const budgetUsed = budgetLines.reduce((s, b) => s + (b.spent || 0), 0);

  const feed = [
    ...treasuryR.slice(0, 5).map((t: any) => ({
      time: format(new Date(t.date), "MMM d"),
      title:
        (t.type === "INFLOW" ? "Inflow" : "Outflow") +
        " · ₹" +
        t.amount.toLocaleString("en-IN"),
      detail: t.reference || t.category || t.notes || t.account,
      tone: (t.type === "INFLOW" ? "ok" : "warn") as any,
      href: "/commercial/treasury",
    })),
    ...supplierInvoicesR.slice(0, 4).map((i: any) => ({
      time: format(new Date(i.invoiceDate), "MMM d"),
      title: i.invoiceNumber + " · ₹" + i.totalAmount.toLocaleString("en-IN"),
      detail:
        (i.supplier?.name || i.supplierId) +
        " · " +
        (i.grn?.matchStatus || "NO_GRN"),
      tone: (i.grn?.matchStatus === "MISMATCHED"
        ? "danger"
        : i.grn?.matchStatus === "MATCHED"
          ? "ok"
          : "info") as any,
      href: "/supply/grn",
    })),
  ].slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance & Accounts"
        description="Payables, receivables, job costing, payroll, GST and treasury — one ledger view."
        icon={<Calculator className="h-5 w-5 text-emerald-500" />}
      />
      <HubClient
        kpis={[
          {
            label: "Receivables",
            value: Math.round(receivablesTotal),
            prefix: "₹",
            icon: <DollarSign className="h-5 w-5 text-sky-500" />,
            hint: receivables.length + " open",
          },
          {
            label: "Payables",
            value: Math.round(payablesTotal),
            prefix: "₹",
            icon: <PackageCheck className="h-5 w-5 text-amber-500" />,
            hint: payables.length + " unpaid",
          },
          {
            label: "3-Way Mismatch",
            value: mismatched.length,
            icon: <AlertTriangle className="h-5 w-5 text-rose-500" />,
            tone: mismatched.length ? "text-rose-500" : undefined,
            hint: "payments blocked",
          },
          {
            label: "Bank Balance",
            value: Math.round(bankBalance),
            prefix: "₹",
            icon: <PiggyBank className="h-5 w-5 text-emerald-500" />,
            hint: "treasury",
          },
          {
            label: "Monthly Payroll",
            value: Math.round(monthPayroll),
            prefix: "₹",
            icon: <Wallet className="h-5 w-5 text-indigo-500" />,
            hint: "this month",
          },
          {
            label: "Cost of Quality",
            value: Math.round(coq.totalCost),
            prefix: "₹",
            icon: <ShieldAlert className="h-5 w-5 text-rose-500" />,
            hint: "scrap+rework+calib+warranty",
          },
        ]}
        quickActions={[
          {
            label: "GRN & 3-Way Match",
            href: "/supply/grn",
            icon: <PackageCheck className="h-4 w-4" />,
            primary: true,
          },
          {
            label: "Receivables Report",
            href: "/reports/receivables",
            icon: <DollarSign className="h-4 w-4" />,
          },
          {
            label: "Profitability",
            href: "/reports/profitability",
            icon: <TrendingUp className="h-4 w-4" />,
          },
          {
            label: "Treasury & Budget",
            href: "/commercial/treasury",
            icon: <PiggyBank className="h-4 w-4" />,
          },
          {
            label: "GST Sales Register",
            href: "/reports/sales-register",
            icon: <BadgeIndianRupee className="h-4 w-4" />,
          },
          {
            label: "Cost of Quality",
            href: "/quality/cost-of-quality",
            icon: <ShieldAlert className="h-4 w-4" />,
          },
          {
            label: "Chart of Accounts",
            href: "/finance/chart-of-accounts",
            icon: <BookOpen className="h-4 w-4" />,
          },
          {
            label: "Journal Entries",
            href: "/finance/journals",
            icon: <FileText className="h-4 w-4" />,
          },
          {
            label: "GL Reports",
            href: "/finance/gl-reports",
            icon: <BarChart3 className="h-4 w-4" />,
          },
          {
            label: "Fiscal Periods",
            href: "/finance/fiscal-periods",
            icon: <CalendarRange className="h-4 w-4" />,
          },
          {
            label: "Expense Claims",
            href: "/finance/expenses",
            icon: <Receipt className="h-4 w-4" />,
          },
          {
            label: "GL Auto-Post Repair",
            href: "/finance/gl-repair",
            icon: <Wrench className="h-4 w-4" />,
          },
          {
            label: "GL Backfill Workbench",
            href: "/finance/gl-backfill",
            icon: <History className="h-4 w-4" />,
          },
        ]}
        sections={[
          {
            id: "payables",
            title: "Accounts Payable — Supplier Invoices",
            icon: <PackageCheck className="h-4 w-4 text-amber-500" />,
            open: true,
            body: (
              <div className="space-y-2">
                {supplierInvoicesR.length === 0 ? (
                  <p className="text-sm text-text-3">
                    No supplier invoices yet.
                  </p>
                ) : (
                  supplierInvoicesR.slice(0, 7).map((i: any) => (
                    <a
                      key={i.id}
                      href="/supply/grn"
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-1 truncate">
                          {i.invoiceNumber} · {i.supplier?.name || i.supplierId}
                        </p>
                        <p className="text-xs text-text-3">
                          ₹{i.totalAmount.toLocaleString("en-IN")}
                          {i.dueDate
                            ? " · due " + format(new Date(i.dueDate), "MMM d")
                            : ""}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          i.grn?.matchStatus === "MISMATCHED"
                            ? "bg-rose-500/10 text-rose-500"
                            : i.grn?.matchStatus === "MATCHED"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-amber-500/10 text-amber-500"
                        }`}
                      >
                        {i.grn?.matchStatus || "NO_GRN"}
                      </span>
                    </a>
                  ))
                )}
              </div>
            ),
          },
          {
            id: "receivables",
            title: "Accounts Receivable — Customer Invoices",
            icon: <DollarSign className="h-4 w-4 text-sky-500" />,
            body: (
              <div className="space-y-2">
                {receivables.length === 0 ? (
                  <p className="text-sm text-text-3">No open receivables.</p>
                ) : (
                  receivables.slice(0, 6).map((i: any) => (
                    <a
                      key={i.id}
                      href="/reports/receivables"
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-1 truncate">
                          {i.invoiceNumber} · {i.customerName}
                        </p>
                        <p className="text-xs text-text-3">
                          ₹
                          {(i.totalValue - i.paidAmount).toLocaleString(
                            "en-IN",
                          )}{" "}
                          outstanding
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          i.status === "UNPAID"
                            ? "bg-amber-500/10 text-amber-500"
                            : i.status === "PARTIAL"
                              ? "bg-sky-500/10 text-sky-500"
                              : "bg-emerald-500/10 text-emerald-500"
                        }`}
                      >
                        {i.status}
                      </span>
                    </a>
                  ))
                )}
              </div>
            ),
          },
          {
            id: "treasury",
            title: "Treasury & Budget",
            icon: <PiggyBank className="h-4 w-4 text-emerald-500" />,
            body: (
              <div className="space-y-2">
                <a
                  href="/commercial/treasury"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm font-medium text-text-1">
                    Bank Balance (all accounts)
                  </span>
                  <span className="text-sm font-bold text-emerald-500">
                    ₹{Math.round(bankBalance).toLocaleString("en-IN")}
                  </span>
                </a>
                <a
                  href="/commercial/treasury"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm font-medium text-text-1">
                    Budget Spent
                  </span>
                  <span className="text-sm font-bold text-text-1">
                    ₹{Math.round(budgetUsed).toLocaleString("en-IN")}
                  </span>
                </a>
                <a
                  href="/people/payroll"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm font-medium text-text-1">
                    Monthly Payroll
                  </span>
                  <span className="text-sm font-bold text-text-1">
                    ₹{Math.round(monthPayroll).toLocaleString("en-IN")}
                  </span>
                </a>
              </div>
            ),
          },
          {
            id: "gst",
            title: "Taxation (GST)",
            icon: <BadgeIndianRupee className="h-4 w-4 text-indigo-500" />,
            body: (
              <div className="space-y-2">
                <a
                  href="/reports/sales-register"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm font-medium text-text-1">
                    GST Sales Register
                  </span>
                  <span className="text-xs font-semibold text-indigo-500">
                    Printable →
                  </span>
                </a>
                <a
                  href="/reports/sales-register"
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <span className="text-sm font-medium text-text-1">
                    GST Challan / Returns
                  </span>
                  <span className="text-xs font-semibold text-indigo-500">
                    Report →
                  </span>
                </a>
              </div>
            ),
          },
        ]}
        feed={feed}
        feedTitle="Cash Movement Feed"
        feedIcon={<ClipboardList className="h-4 w-4 text-emerald-500" />}
        feedEmpty="No cash movements yet."
      />
    </div>
  );
}
