import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import Link from "next/link";
import {
  Printer,
  FileText,
  Clock,
  Gauge,
  BarChart2,
  Users,
  Sparkles,
  Truck,
  ClipboardEdit,
  Trophy,
  Cpu,
  Layers,
  ArrowRight,
  DollarSign,
  Boxes,
  ShoppingBag,
  PackageCheck,
  Wrench,
  Calendar,
  ShieldCheck,
  Ship,
  BadgeIndianRupee,
  Wallet,
  AlertTriangle,
  Star,
  ClipboardCheck,
  CalendarRange,
  FileCheck2,
  ListChecks,
  FileSignature,
  Presentation,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const REPORT_CARDS = [
  {
    id: "payroll",
    title: "Payroll & Compensation Summary",
    href: "/reports/payroll",
    icon: DollarSign,
    badge: "Payroll & CSV Export",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    desc: "Monthly operator payroll calculation register (present days, late days, regular pay, OT pay, gross pay, statutory limit flag), printable report, and Excel/Tally-compatible CSV export.",
  },
  {
    id: "sales-register",
    title: "Sales & GST Tax Invoice Register",
    href: "/reports/sales-register",
    icon: FileText,
    badge: "GST Tax Invoices",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    desc: "Taxable sales ledger of issued GST Invoices with date range filters, customer GSTIN, taxable amount, CGST, SGST, IGST tax breakdown, and grand totals.",
  },
  {
    id: "material-plan",
    title: "Material Requirement & Readiness Plan",
    href: "/reports/material-plan",
    icon: PackageCheck,
    badge: "MRP & Material Plan",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    desc: "Printable Material Requirement Planning (MRP) schedule comparing raw material stock vs total Work Order demand across chosen date ranges.",
  },
  {
    id: "capacity-plan",
    title: "Weekly Capacity Plan",
    href: "/reports/capacity",
    icon: Calendar,
    badge: "Scheduling & Load",
    badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    desc: "Machine-level capacity forecasting matrix, showing overloaded days, available hours, and contributing Work Orders for production leveling.",
  },
  {
    id: "po-register",
    title: "Purchase Order Register",
    href: "/reports/po-register",
    icon: ShoppingBag,
    badge: "Procurement & POs",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    desc: "Complete procurement ledger of open & closed Purchase Orders, supplier commitments, expected delivery dates, and fulfillment status.",
  },
  {
    id: "stock-register",
    title: "Stock Register & Batch Ledger",
    href: "/reports/stock-register",
    icon: Boxes,
    badge: "Inventory & Batches",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    desc: "Comprehensive raw material movement ledger, stock receipts (IN), job issuances (OUT), batch tracking, and physical audit adjustments.",
  },
  {
    id: "material-certs",
    title: "Material Certs & Heat Register",
    href: "/reports/material-certs",
    icon: FileText,
    badge: "Aerospace Compliance",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    desc: "Printable register of all material certifications, heat numbers, specification grades, and expiration tracking.",
  },
  {
    id: "calibration-register",
    title: "Calibration Register",
    href: "/reports/calibration-register",
    icon: Gauge,
    badge: "Nadcap Metrology",
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    desc: "Printable calibration register of all inspection tooling (gauges, torque wrenches, CMMs, micrometers) with serial, cert number, calibration date, expiry, and live status. The first list an AS9100/Nadcap auditor asks for.",
  },
  {
    id: "special-process-vendors",
    title: "Approved Special Process Vendors",
    href: "/reports/special-process-vendors",
    icon: ShieldCheck,
    badge: "Nadcap Suppliers",
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    desc: "Printable register of outsourced special-process suppliers (heat treat, plating, NDT, welding, anodize) with Nadcap certificate numbers and expiry dates, flagged APPROVED or EXPIRED.",
  },
  {
    id: "statutory",
    title: "PF / ESI Statutory Register",
    href: "/reports/statutory",
    icon: BadgeIndianRupee,
    badge: "HR Statutory",
    badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    desc: "Monthly Provident Fund and ESI contribution register per employee with totals â€” the statutory compliance evidence file for PF/ESI inspections.",
  },
  {
    id: "pf-esi-challan",
    title: "PF / ESI Payment Challan",
    href: "/reports/pf-esi-challan",
    icon: BadgeIndianRupee,
    badge: "Payment Challan",
    badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    desc: "Monthly PF/ESI payment challan aggregating employee & employer shares per scheme, with amount-in-words and signature blocks â€” ready for bank submission.",
  },
  {
    id: "payslips",
    title: "Monthly Salary Payslips",
    href: "/reports/payslips",
    icon: Wallet,
    badge: "Payroll & Salary",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    desc: "Printable employee payslips per month â€” earnings breakup, PF & professional-tax deductions, net pay, and signature blocks.",
  },
  {
    id: "compliance-digest",
    title: "Daily Compliance Digest",
    href: "/reports/compliance-digest",
    icon: AlertTriangle,
    badge: "Management Briefing",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    desc: "One-page daily briefing of every critical and warning compliance flag â€” environment, backups, spares, contracts, calibration, vendors, NCRs and ECOs â€” with owner dispatch log.",
  },
  {
    id: "supplier-scorecards",
    title: "Supplier Scorecard Register",
    href: "/reports/supplier-scorecards",
    icon: Star,
    badge: "Supplier SQA",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    desc: "Printable quarterly supplier KPI register â€” OTD, quality PPM, cost variance, responsiveness, weighted overall score and A-D grade.",
  },
  {
    id: "audit-register",
    title: "Internal Audit Register",
    href: "/reports/audit-register",
    icon: ClipboardCheck,
    badge: "QMS Evidence",
    badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    desc: "Printable ISO 9001 / AS9100 audit schedule with findings, open and critical counts per audit â€” the register an auditor asks for.",
  },
  {
    id: "quality-calendar",
    title: "Annual Quality Calendar",
    href: "/reports/quality-calendar",
    icon: CalendarRange,
    badge: "QMS Planning",
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    desc: "Year-at-a-glance plan of internal audits, calibration due dates, preventive maintenance and statutory renewals â€” the forward-looking register for AS9100 planning.",
  },
  {
    id: "exim",
    title: "EXIM Shipment Register",
    href: "/reports/exim",
    icon: Ship,
    badge: "Export / Import",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    desc: "Printable import/export shipment register with mode, incoterm, port, customs value, and clearance status for customs / DGFT audit.",
  },
  {
    id: "mrb",
    title: "MRB Register",
    href: "/reports/mrb",
    icon: FileText,
    badge: "Quality & Compliance",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    desc: "Material Review Board register of all Non-Conformance Reports (NCR), quarantine actions, root cause analyses, and dispositions.",
  },
  {
    id: "mrm-minutes",
    title: "Management Review (MRM) Minutes",
    href: "/quality/mrm",
    icon: Presentation,
    badge: "ISO 9001 cl.9.3",
    badgeColor: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    desc: "Management review meetings with auto-pulled agenda (digest flags + quality objectives), recorded minutes and decisions, action items — printable ISO 9001 cl.9.3 minutes per meeting.",
  },
  {
    id: "eight-d-register",
    title: "8D Problem Solving Register",
    href: "/reports/eight-d-register",
    icon: ClipboardCheck,
    badge: "CAPA & 8D",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    desc: "Printable 8-discipline problem-solving register with linked NCRs, root-cause summaries, CAPA action counts, and closure status â€” CAPA evidence for ISO 9001 / AS9100.",
  },
  {
    id: "ppap-register",
    title: "PPAP Submission Register",
    href: "/reports/ppap-register",
    icon: FileCheck2,
    badge: "PPAP / IATF",
    badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    desc: "Printable Production Part Approval Process register â€” AIAG 18-element progress per part, submission level, customer, and approval disposition.",
  },
  {
    id: "control-plan",
    title: "Control Plan Sheet",
    href: "/reports/control-plan",
    icon: ListChecks,
    badge: "IATF / AS9100",
    badgeColor: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    desc: "Printable Control Plan per product â€” characteristic, specification, measurement method, sample/frequency, control method, and reaction plan.",
  },
  {
    id: "psw",
    title: "Part Submission Warrant (PSW)",
    href: "/reports/psw",
    icon: FileSignature,
    badge: "AIAG PPAP Form",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    desc: "Printable AIAG Part Submission Warrant per PPAP â€” part information, 18-element results, approval disposition, and supplier/customer sign-off blocks.",
  },
  {
    id: "grn-register",
    title: "GRN & 3-Way Match Register",
    href: "/reports/grn-register",
    icon: PackageCheck,
    badge: "AP Control",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    desc: "Printable Goods Receipt Note and supplier invoice ledger with PO â‡„ GRN â‡„ Invoice three-way match status â€” the accounts payable control evidence file.",
  },
  {
    id: "eco-register",
    title: "Engineering Change Order (ECO) Register",
    href: "/reports/eco-register",
    icon: FileText,
    badge: "Engineering & Config",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    desc: "Printable register of all Engineering Change Orders, their statuses, effectivities, and approval signatures.",
  },
  {
    id: "data-package",
    title: "Data Package (Birth Record)",
    href: "/reports/data-package",
    icon: PackageCheck,
    badge: "Dossier & Genealogy",
    badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    desc: "Compiled product birth record containing material certs, FAI, inspections, NCRs, serial genealogy, and release signatures.",
  },
  {
    id: "inventory-valuation",
    title: "Inventory Valuation Report",
    href: "/reports/inventory-valuation",
    icon: DollarSign,
    badge: "Asset Valuation",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    desc: "On-hand raw material stock asset valuation (Current Stock Ã— Unit Cost), SKU asset distribution %, and reorder status chips.",
  },
  {
    id: "profitability",
    title: "Job Profitability Report",
    href: "/reports/profitability",
    icon: DollarSign,
    badge: "Financial Analysis",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    desc: "Financial job costing analysis, revenue, total cost, net profit, margin %, and highlighted loss-making work orders.",
  },
  {
    id: "morning-pack",
    title: "Morning Meeting Pack",
    href: "/reports/morning-pack",
    icon: Layers,
    badge: "Multi-Page Composite",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    desc: "Executive multi-page briefing: Plant KPIs, Plan vs Actual, Downtime Pareto, Today's Attendance, & 5S Leaderboard.",
  },
  {
    id: "daily",
    title: "Daily Production Report",
    href: "/reports/daily",
    icon: FileText,
    badge: "Core Output",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    desc: "Shift-by-shift summary of total output, good units, scrap rate, and machine run hours.",
  },
  {
    id: "downtime",
    title: "Downtime Report",
    href: "/reports/downtime",
    icon: Clock,
    badge: "Machine Losses",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    desc: "Detailed machine stoppage logs, duration in minutes, and root cause classification.",
  },
  {
    id: "performance",
    title: "Performance & OEE Report",
    href: "/reports/performance",
    icon: Gauge,
    badge: "OEE Matrix",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    desc: "Machine Availability, Performance, Quality, and overall OEE matrix with threshold indicators.",
  },
  {
    id: "pareto",
    title: "Downtime Pareto Report",
    href: "/reports/pareto",
    icon: BarChart2,
    badge: "Loss Analysis",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    desc: "Print-friendly Pareto breakdown of top factory downtime contributors & cumulative percentages.",
  },
  {
    id: "operator-efficiency",
    title: "Operator Efficiency Register",
    href: "/reports/operator-efficiency",
    icon: Users,
    badge: "Skill Matrix",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    desc: "Operator hours logged, total good units, scrap rate %, calculated efficiency %, and skill rating.",
  },
  {
    id: "attendance",
    title: "Attendance Register",
    href: "/reports/attendance",
    icon: UserCircle,
    badge: "Time & Attendance",
    badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    desc: "Today's shift attendance board (On-time/Late/Absent) and monthly shift attendance logs.",
  },
  {
    id: "fives",
    title: "5S Audit Sheet & Blank Form",
    href: "/reports/fives",
    icon: Sparkles,
    badge: "Lean 5S",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    desc: "Completed 5S audit report inspection + blank shopfloor physical 5S clipboard audit sheet.",
  },
  {
    id: "traveler",
    title: "Job Traveler Card",
    href: "/reports/traveler",
    icon: Truck,
    badge: "Routing & Traveler",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    desc: "Work Order Job Traveler card with routing operation steps, physical sign-off lines, and material movement history.",
  },
  {
    id: "shift",
    title: "Shift Summary & Handover",
    href: "/reports/shift",
    icon: ClipboardEdit,
    badge: "Shift Briefing",
    badgeColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    desc: "Shift output, downtime summary, operator list, and supervisor shift handover notes.",
  },
  {
    id: "leaderboard",
    title: "Monthly Leaderboard Report",
    href: "/reports/leaderboard",
    icon: Trophy,
    badge: "Gamification",
    badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    desc: "Monthly operator performance leaderboard, badges, and recognition certificates.",
  },
  {
    id: "machine-history",
    title: "Machine History Card",
    href: "/reports/machine-history",
    icon: Cpu,
    badge: "Equipment History",
    badgeColor: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    desc: "Equipment history card with MTBF, MTTR, top downtime causes, and 30-day log history.",
  },
  {
    id: "maintenance",
    title: "Maintenance Register",
    href: "/reports/maintenance",
    icon: Wrench,
    badge: "Maintenance Log",
    badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    desc: "Printable maintenance register: all job cards with root cause, parts used, cost, and labor hours. Includes PM schedule and tool life summary.",
  },
  {
    id: "ot-register",
    title: "OT Register",
    href: "/reports/ot-register",
    icon: Clock,
    badge: "Overtime & Compliance",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    desc: "Per-operator daily overtime register. Pick operator + month to view worked hours, OT hours, estimated OT pay, and statutory limit compliance.",
  },
  {
    id: "receivables",
    title: "Receivables & Aging Report",
    href: "/reports/receivables",
    icon: DollarSign,
    badge: "Financial & Accounts",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    desc: "Customer ledger of unpaid/partially paid invoices with aging buckets (0-30, 31-60, 61-90, 90+ days) and total outstanding balances.",
  },
];

import { UserCircle } from "lucide-react";

export default async function ReportsHubPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/reports");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-6">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Printer className="w-8 h-8 text-blue-500" />
              Factory Print Center &amp; Report Hub
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Generate, preview, and print 12 official plant documents formatted
              for PDF export and high-resolution printing.
            </p>
          </div>
        </header>

        {/* REPORT CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {REPORT_CARDS.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.id}
                href={card.href}
                className="group bg-slate-800/60 border border-slate-700 hover:border-blue-500 hover:border-blue-500 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-slate-800/60 text-blue-400 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold font-mono border ${card.badgeColor}`}
                    >
                      {card.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-white group-hover:text-blue-500 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {card.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-700 flex items-center justify-between text-xs font-bold text-blue-400 group-hover:translate-x-1 transition-transform">
                  <span>Open Print Document</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
