import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import Link from "next/link";
import {
  Crown,
  FlaskConical,
  Factory,
  ShieldCheck,
  Gauge,
  Truck,
  LineChart,
  Calculator,
  Users,
  Leaf,
  Wrench,
  FolderKanban,
  Cpu,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

type ItemStatus = "LIVE" | "PARTIAL" | "PLANNED";

interface DeptItem {
  name: string;
  href?: string;
  status: ItemStatus;
}

interface Department {
  no: number;
  title: string;
  icon: any;
  color: string;
  desc: string;
  items: DeptItem[];
}

const DEPARTMENTS: Department[] = [
  {
    no: 1,
    title: "Executive & Management",
    icon: Crown,
    color: "text-purple-500 bg-purple-500/10 border-purple-500/30",
    desc: "MD / CEO office, strategy, legal, and investor relations.",
    items: [
      { name: "MD / CEO Office", href: "/command", status: "LIVE" },
      {
        name: "Business Strategy & Planning",
        href: "/reports/morning-pack",
        status: "LIVE",
      },
      {
        name: "Legal & Corporate Compliance",
        href: "/system/admin?tab=audit",
        status: "LIVE",
      },
      { name: "Investor Relations", href: "/system/investors", status: "LIVE" },
    ],
  },
  {
    no: 2,
    title: "Engineering & R&D",
    icon: FlaskConical,
    color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/30",
    desc: "Design, process engineering, configuration control, and the R&D lab.",
    items: [
      { name: "Product Design (CAD)", href: "/projects", status: "LIVE" },
      {
        name: "Process Engineering (CAM / Routings)",
        href: "/system/admin?tab=routingSteps",
        status: "LIVE",
      },
      {
        name: "Tooling & Fixture Design",
        href: "/supply/tools",
        status: "LIVE",
      },
      {
        name: "Configuration Management (ECO / ECN)",
        href: "/eco",
        status: "LIVE",
      },
      { name: "Prototyping & R&D Lab", href: "/rnd", status: "LIVE" },
      { name: "Testing & Validation Lab", href: "/rnd", status: "LIVE" },
    ],
  },
  {
    no: 3,
    title: "Production / Operations",
    icon: Factory,
    color: "text-blue-500 bg-blue-500/10 border-blue-500/30",
    desc: "Planning, scheduling, shopfloor execution, and the tool room.",
    items: [
      {
        name: "Production Planning & Control (PPC)",
        href: "/ops/work-orders",
        status: "LIVE",
      },
      {
        name: "Scheduling & Dispatch Planning",
        href: "/ops/schedule",
        status: "LIVE",
      },
      {
        name: "Shopfloor (Machining / Assembly)",
        href: "/ops/floor",
        status: "LIVE",
      },
      { name: "Shift Operations", href: "/people/handover", status: "LIVE" },
      {
        name: "Industrial Engineering (Time & Method)",
        href: "/ops/capacity",
        status: "LIVE",
      },
      { name: "Tool Room", href: "/supply/tools", status: "LIVE" },
    ],
  },
  {
    no: 4,
    title: "Quality (QA / QC)",
    icon: ShieldCheck,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
    desc: "Incoming, in-process and final QC, NDT, NCR/MRB, and QMS audits.",
    items: [
      { name: "Incoming QC (IQC)", href: "/certs", status: "LIVE" },
      { name: "In-Process QC (IPQC)", href: "/ops/spc", status: "LIVE" },
      { name: "Final QC (FQC)", href: "/fai", status: "LIVE" },
      {
        name: "NDT (Non-Destructive Testing)",
        href: "/reports/special-process-vendors",
        status: "LIVE",
      },
      { name: "NCR / MRB (Non-Conformance)", href: "/mrb", status: "LIVE" },
      {
        name: "Customer Quality & Complaints",
        href: "/commercial/desk",
        status: "LIVE",
      },
      {
        name: "QMS & Audits (ISO 9001 / AS9100)",
        href: "/system/qms",
        status: "LIVE",
      },
    ],
  },
  {
    no: 5,
    title: "Instrumentation / Metrology (Tool Crib)",
    icon: Gauge,
    color: "text-teal-500 bg-teal-500/10 border-teal-500/30",
    desc: "Instrument master register, custody, calibration, quarantine cage.",
    items: [
      {
        name: "Instrument Master Register",
        href: "/system/admin?tab=metrology",
        status: "LIVE",
      },
      {
        name: "Issue / Return Logs",
        href: "/system/admin?tab=metrology",
        status: "LIVE",
      },
      {
        name: "Location & Custody Tracking",
        href: "/system/admin?tab=metrology",
        status: "LIVE",
      },
      {
        name: "Calibration Scheduling & Cert Archive",
        href: "/system/admin?tab=metrology",
        status: "LIVE",
      },
      {
        name: "Out-of-Calibration Quarantine Cage",
        href: "/system/admin?tab=metrology",
        status: "LIVE",
      },
      {
        name: "Instrument Procurement & Retirement",
        href: "/system/admin?tab=metrology",
        status: "LIVE",
      },
    ],
  },
  {
    no: 6,
    title: "Supply Chain & Materials",
    icon: Truck,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
    desc: "Procurement, suppliers, stores, inventory, logistics, EXIM.",
    items: [
      {
        name: "Purchasing / Procurement",
        href: "/system/admin?tab=purchasing",
        status: "LIVE",
      },
      {
        name: "Supplier Development & SQA",
        href: "/supply/vault",
        status: "LIVE",
      },
      {
        name: "Stores & Warehousing (RM / WIP / FG)",
        href: "/supply/vault",
        status: "LIVE",
      },
      {
        name: "Inventory Control",
        href: "/reports/stock-register",
        status: "LIVE",
      },
      {
        name: "Logistics, Dispatch & Transport",
        href: "/commercial/desk",
        status: "LIVE",
      },
      {
        name: "EXIM (Imports / Exports)",
        href: "/commercial/exim",
        status: "LIVE",
      },
    ],
  },
  {
    no: 7,
    title: "Sales & Marketing",
    icon: LineChart,
    color: "text-sky-500 bg-sky-500/10 border-sky-500/30",
    desc: "Quotations, order booking, marketing, export sales.",
    items: [
      {
        name: "Quotations & Estimation",
        href: "/commercial/quotations",
        status: "LIVE",
      },
      {
        name: "Order Booking & Customer Service",
        href: "/commercial/desk",
        status: "LIVE",
      },
      {
        name: "Marketing & Branding",
        href: "/commercial/marketing",
        status: "LIVE",
      },
      { name: "Export Sales", href: "/commercial/exim", status: "LIVE" },
    ],
  },
  {
    no: 8,
    title: "Finance & Accounts",
    icon: Calculator,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
    desc: "Payables, receivables, job costing, payroll, GST, treasury.",
    items: [
      {
        name: "Accounts Payable (Suppliers)",
        href: "/commercial/desk",
        status: "LIVE",
      },
      {
        name: "Accounts Receivable (Customers)",
        href: "/reports/receivables",
        status: "LIVE",
      },
      {
        name: "Cost Accounting (Job Costing)",
        href: "/reports/profitability",
        status: "LIVE",
      },
      { name: "Payroll", href: "/people/payroll", status: "LIVE" },
      {
        name: "Taxation (GST) & Statutory Filings",
        href: "/reports/sales-register",
        status: "LIVE",
      },
      {
        name: "Budgeting, Treasury & Audit",
        href: "/commercial/treasury",
        status: "LIVE",
      },
    ],
  },
  {
    no: 9,
    title: "Human Resources",
    icon: Users,
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/30",
    desc: "Recruitment, training, time office, HR ops, statutory compliance.",
    items: [
      {
        name: "Recruitment & Onboarding",
        href: "/people/recruitment",
        status: "LIVE",
      },
      {
        name: "Training & Skill Development",
        href: "/system/admin?tab=certifications",
        status: "LIVE",
      },
      {
        name: "Time Office (Attendance / Shifts / Leave)",
        href: "/people/attendance",
        status: "LIVE",
      },
      {
        name: "HR Operations (Discipline, Welfare)",
        href: "/people/pulse",
        status: "LIVE",
      },
      {
        name: "Statutory Compliance (PF / ESI / Factories Act)",
        href: "/people/statutory",
        status: "LIVE",
      },
    ],
  },
  {
    no: 10,
    title: "EHS â€” Environment, Health & Safety",
    icon: Leaf,
    color: "text-lime-500 bg-lime-500/10 border-lime-500/30",
    desc: "Safety investigation, occupational health, environment, fire.",
    items: [
      {
        name: "Safety & Incident Investigation",
        href: "/system/safety",
        status: "LIVE",
      },
      { name: "Occupational Health", href: "/system/ehs", status: "LIVE" },
      { name: "Environmental Compliance", href: "/system/ehs", status: "LIVE" },
      {
        name: "Fire & Emergency Response",
        href: "/system/ehs",
        status: "LIVE",
      },
    ],
  },
  {
    no: 11,
    title: "Maintenance & Utilities",
    icon: Wrench,
    color: "text-orange-500 bg-orange-500/10 border-orange-500/30",
    desc: "Breakdown, preventive/predictive maintenance, utilities, spares.",
    items: [
      {
        name: "Breakdown Maintenance",
        href: "/system/maintenance",
        status: "LIVE",
      },
      {
        name: "Preventive / Predictive Maintenance",
        href: "/system/maintenance",
        status: "LIVE",
      },
      {
        name: "Utilities (Power, Compressors, HVAC)",
        href: "/system/utilities",
        status: "LIVE",
      },
      { name: "Spares Management", href: "/supply/spares", status: "LIVE" },
    ],
  },
  {
    no: 12,
    title: "Projects / Program Management",
    icon: FolderKanban,
    color: "text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/30",
    desc: "Aero/defence programs, customer coordination, contracts.",
    items: [
      {
        name: "Program Planning (Aero / Defence)",
        href: "/projects",
        status: "LIVE",
      },
      {
        name: "Customer Program Coordination",
        href: "/projects",
        status: "LIVE",
      },
      {
        name: "Contract Management",
        href: "/projects/contracts",
        status: "LIVE",
      },
    ],
  },
  {
    no: 13,
    title: "IT & Systems",
    icon: Cpu,
    color: "text-rose-500 bg-rose-500/10 border-rose-500/30",
    desc: "ERP/MES administration, infrastructure, cybersecurity, data.",
    items: [
      {
        name: "ERP / MES Administration",
        href: "/system/admin",
        status: "LIVE",
      },
      {
        name: "Infrastructure & Networks",
        href: "/system/infrastructure",
        status: "LIVE",
      },
      {
        name: "Cybersecurity & Access Control",
        href: "/system/admin?tab=users",
        status: "LIVE",
      },
      {
        name: "Data & Backups",
        href: "/system/infrastructure",
        status: "LIVE",
      },
    ],
  },
];

function statusBadge(status: ItemStatus) {
  if (status === "LIVE") {
    return (
      <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
        LIVE
      </span>
    );
  }
  if (status === "PARTIAL") {
    return (
      <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
        PARTIAL
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/30">
      PLANNED
    </span>
  );
}

export default async function DepartmentsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/departments");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  const totalItems = DEPARTMENTS.reduce((sum, d) => sum + d.items.length, 0);
  const liveItems = DEPARTMENTS.reduce(
    (sum, d) => sum + d.items.filter((i) => i.status !== "PLANNED").length,
    0,
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Factory className="w-8 h-8 text-blue-500" />
              Enterprise Organization â€” All Departments
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Every department of the manufacturing enterprise, mapped to its
              live implementation in this system.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-bold">
              {liveItems}/{totalItems} functions live
            </div>
            <div className="px-4 py-2 rounded-xl bg-slate-800/60 border border-slate-600 text-slate-600 text-slate-300 text-sm font-bold">
              {DEPARTMENTS.length} departments
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {DEPARTMENTS.map((dept) => {
            const Icon = dept.icon;
            return (
              <div
                key={dept.no}
                className="bg-slate-800/60 border border-slate-700 rounded-2xl shadow-sm hover:shadow-xl transition-all flex flex-col"
              >
                <div className="p-5 border-b border-slate-700 flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl border ${dept.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Department {dept.no}
                    </div>
                    <h2 className="text-lg font-extrabold text-white leading-tight">
                      {dept.title}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {dept.desc}
                    </p>
                  </div>
                </div>

                <ul className="p-3 space-y-1 flex-1">
                  {dept.items.map((item) => (
                    <li key={item.name}>
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800/90 hover:text-blue-600 hover:text-blue-400 transition-colors group"
                        >
                          <span className="flex items-center gap-2">
                            <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-500" />
                            {item.name}
                          </span>
                          {statusBadge(item.status)}
                        </Link>
                      ) : (
                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-slate-500">
                          <span className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 inline-block" />
                            {item.name}
                          </span>
                          {statusBadge(item.status)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-slate-500 pb-8">
          Manufacturing MAX Â· Enterprise Department Tree Â· LIVE = fully
          implemented module, PARTIAL = implemented with limited scope, PLANNED
          = next build target.
        </p>
      </div>
    </div>
  );
}
