import {
  Crown,
  FlaskConical,
  Factory,
  ShieldCheck,
  Gauge,
  Truck,
  LineChart,
  ListOrdered,
  Calculator,
  Users,
  Leaf,
  Wrench,
  FolderKanban,
  Cpu,
  Ruler,
  ClipboardList,
  CalendarRange,
  Activity,
  Timer,
  Shuffle,
  AlertTriangle,
  Package,
  PackageCheck,
  Boxes,
  Wrench as WrenchIcon,
  Cog,
  Star,
  BarChart3,
  FileText,
  Megaphone,
  PiggyBank,
  Ship,
  UserPlus,
  UserCircle,
  Trophy,
  BadgeIndianRupee,
  Wallet,
  HeartPulse,
  Zap,
  Server,
  FileSignature,
  Beaker,
  ClipboardX,
  FileCheck2,
  ListChecks,
  DollarSign,
  FolderOpen,
  Sparkles,
  Bell,
  BellRing,
  HandCoins,
  Network,
  Siren,
  Trash2,
  Brain,
  Lightbulb,
  LayoutGrid,
  TrendingUp,
  FileUp,
  CalendarClock,
  Award,
  Presentation,
  Target,
  Clock,
  PackageOpen,
  Scale,
  Filter,
  ShieldAlert,
  Landmark,
  Gavel,
  HardHat,
  TestTube,
  Droplets,
  Biohazard,
  Flame,
  Monitor,
  Ticket,
  ClipboardCheck,
  Layers,
  FolderTree,
  Search,
  Radio,
  Workflow,
  Terminal,
  FileCode2,
  Mic,
  Navigation,
  PieChart,
  Bot,
} from "lucide-react";

export interface SubFunction {
  name: string;
  desc: string;
  href: string;
  icon: any;
}

export interface Department {
  no: number;
  id: string;
  title: string;
  short: string;
  desc: string;
  icon: any;
  gradient: string; // tailwind gradient classes
  glow: string; // rgba glow for hover
  permissionKey: string; // e.g. "quality.view"
  hub: string; // landing page for the department
  functions: SubFunction[];
}

export const DEPARTMENTS: Department[] = [
  {
    no: 1,
    id: "executive",
    title: "Executive & Management",
    short: "Executive",
    desc: "MD / CEO office, strategy, legal, investor relations.",
    icon: Crown,
    gradient: "from-purple-400 to-violet-600",
    glow: "rgba(168,85,247,0.35)",
    permissionKey: "exec.view",
    hub: "/command",
    functions: [
      {
        name: "MD / CEO Office",
        desc: "God View command centre",
        href: "/command",
        icon: Crown,
      },
      {
        name: "Business Strategy & Planning",
        desc: "Morning pack & KPIs",
        href: "/reports/morning-pack",
        icon: BarChart3,
      },
      {
        name: "Legal & Corporate Compliance",
        desc: "Audit trail",
        href: "/system/admin?tab=audit",
        icon: ClipboardList,
      },
      {
        name: "Investor Relations",
        desc: "Investor updates",
        href: "/system/investors",
        icon: FolderOpen,
      },
      {
        name: "Reports & Registers",
        desc: "All printable registers",
        href: "/reports",
        icon: LayoutGrid,
      },
      {
        name: "Executive Briefing",
        desc: "Boardroom performance pack",
        href: "/reports/executive-briefing",
        icon: PieChart,
      },
      {
        name: "Board Pack",
        desc: "M32 — monthly auto-compiled pack",
        href: "/reports/board-pack",
        icon: LayoutGrid,
      },
      {
        name: "Escalation Board",
        desc: "SLA escalations",
        href: "/system/escalations",
        icon: Siren,
      },
      {
        name: "Notifications & Alerts",
        desc: "Alert centre",
        href: "/notifications",
        icon: Bell,
      },
      {
        name: "Organization Tree",
        desc: "Department structure",
        href: "/departments",
        icon: Network,
      },
    ],
  },
  {
    no: 2,
    id: "engineering",
    title: "Engineering & R&D",
    short: "Engineering",
    desc: "Design, process engineering, configuration, R&D lab.",
    icon: FlaskConical,
    gradient: "from-cyan-400 to-sky-600",
    glow: "rgba(34,211,238,0.35)",
    permissionKey: "engineering.view",
    hub: "/engineering",
    functions: [
      {
        name: "Product Design (CAD)",
        desc: "Projects & design",
        href: "/projects",
        icon: FolderKanban,
      },
      {
        name: "Multi-Level BOM Tree",
        desc: "Hierarchy & cost rollup",
        href: "/engineering/bom-tree",
        icon: FolderTree,
      },
      {
        name: "CNC Machining Calculator",
        desc: "Speeds, feeds, power & Ra",
        href: "/engineering/cnc-calc",
        icon: Calculator,
      },
      {
        name: "Process Engineering (CAM)",
        desc: "Routings & operations",
        href: "/system/admin?tab=routingSteps",
        icon: Cog,
      },
      {
        name: "Tooling & Fixture Register",
        desc: "Fixture status & WO gate",
        href: "/engineering/fixtures",
        icon: WrenchIcon,
      },
      {
        name: "Drawing Transmittal",
        desc: "Rev release & ack",
        href: "/engineering/transmittals",
        icon: FileSignature,
      },
      {
        name: "Configuration (ECO / ECN)",
        desc: "Change management",
        href: "/eco",
        icon: FileSignature,
      },
      {
        name: "Visual ECO Diff & Approvals",
        desc: "BOM revision comparison",
        href: "/eco/diff",
        icon: FileSignature,
      },
      {
        name: "Prototyping & R&D Lab",
        desc: "Test campaigns",
        href: "/rnd",
        icon: Beaker,
      },
      {
        name: "3D Digital Twin Workcell",
        desc: "Physics-based cell simulation",
        href: "/digital-twin/cell",
        icon: Boxes,
      },
      {
        name: "Virtual Commissioning (PLC)",
        desc: "IO mapping & ladder logic",
        href: "/digital-twin/commissioning",
        icon: Cpu,
      },
      {
        name: "Testing & Validation Lab",
        desc: "FAI & test records",
        href: "/fai",
        icon: Ruler,
      },
    ],
  },
  {
    no: 3,
    id: "production",
    title: "Production / Operations",
    short: "Production",
    desc: "Planning, scheduling, shopfloor, tool room.",
    icon: Factory,
    gradient: "from-blue-400 to-indigo-600",
    glow: "rgba(59,130,246,0.35)",
    permissionKey: "ops.view",
    hub: "/ops/floor",
    functions: [
      {
        name: "Production Planning (PPC)",
        desc: "Work orders",
        href: "/ops/work-orders",
        icon: ClipboardList,
      },
      {
        name: "PPC Priority Board",
        desc: "Drag-resequence queue",
        href: "/ops/ppc",
        icon: ListOrdered,
      },
      {
        name: "S&OP Planning",
        desc: "Order book vs capacity",
        href: "/ops/sop",
        icon: CalendarRange,
      },
      {
        name: "Finite Capacity",
        desc: "Machine × day load",
        href: "/ops/finite-capacity",
        icon: Gauge,
      },
      {
        name: "Tool Room",
        desc: "Tool life & regrinds",
        href: "/ops/tool-room",
        icon: Wrench,
      },
      {
        name: "IE Observations",
        desc: "Lean waste log",
        href: "/ops/ie-observations",
        icon: Timer,
      },
      {
        name: "Shift Roster",
        desc: "Publish weekly roster",
        href: "/ops/roster",
        icon: CalendarClock,
      },
      {
        name: "Scheduling & Dispatch",
        desc: "Schedule & capacity",
        href: "/ops/schedule",
        icon: CalendarRange,
      },
      {
        name: "Packaging Station",
        desc: "Barcode scanner & packing",
        href: "/ops/packaging",
        icon: PackageCheck,
      },
      {
        name: "Shopfloor Tablet Kiosk",
        desc: "Touch piece clocking",
        href: "/ops/kiosk",
        icon: Gauge,
      },
      {
        name: "Voice Command Terminal",
        desc: "Hands-free speech clocking",
        href: "/ops/voice",
        icon: Mic,
      },
      {
        name: "Shopfloor",
        desc: "Live floor & war room",
        href: "/ops/floor",
        icon: Factory,
      },
      {
        name: "DPM Board",
        desc: "Daily plan vs actual",
        href: "/ops/dpm",
        icon: CalendarRange,
      },
      {
        name: "Shift Operations",
        desc: "Handover logbook",
        href: "/people/handover",
        icon: Users,
      },
      {
        name: "Industrial Engineering",
        desc: "Time study & capacity",
        href: "/ops/time-study",
        icon: Timer,
      },
      {
        name: "Andon & SPC",
        desc: "Live signals & SPC",
        href: "/ops/andon",
        icon: Activity,
      },
      {
        name: "Hourly Andon",
        desc: "Hour targets vs actual",
        href: "/ops/hourly-andon",
        icon: Activity,
      },
      {
        name: "Rework & Scrap",
        desc: "Non-conformance boards",
        href: "/ops/rework",
        icon: Shuffle,
      },
      {
        name: "Capacity Planning",
        desc: "Load & bottlenecks",
        href: "/ops/capacity",
        icon: BarChart3,
      },
      {
        name: "Scrap Analysis",
        desc: "Scrap Pareto",
        href: "/ops/scrap",
        icon: Trash2,
      },
      {
        name: "Machines",
        desc: "Machine register",
        href: "/system/machines",
        icon: Cog,
      },
    ],
  },
  {
    no: 4,
    id: "quality",
    title: "Quality (QA / QC)",
    short: "Quality",
    desc: "IQC, IPQC, FQC, NDT, NCR/MRB, QMS & audits.",
    icon: ShieldCheck,
    gradient: "from-emerald-400 to-green-600",
    glow: "rgba(16,185,129,0.35)",
    permissionKey: "quality.view",
    hub: "/quality/hub",
    functions: [
      {
        name: "360° Lot & Serial Genealogy",
        desc: "Upstream & downstream trace",
        href: "/quality/genealogy",
        icon: Search,
      },
      {
        name: "Incoming QC (IQC)",
        desc: "Material certs",
        href: "/certs",
        icon: ShieldCheck,
      },
      {
        name: "IQC Sampling (AQL)",
        desc: "M6 — sampling tables + lot HOLD",
        href: "/quality/iqc",
        icon: FlaskConical,
      },
      {
        name: "In-Process QC (IPQC)",
        desc: "Checklists & SPC anomalies",
        href: "/quality/ipqc",
        icon: Activity,
      },
      {
        name: "SPC Metrology Charts",
        desc: "Live X-bar, R & Cpk charts",
        href: "/quality/spc-charts",
        icon: LineChart,
      },
      {
        name: "Final QC (FQC)",
        desc: "First article (FAI)",
        href: "/fai",
        icon: Ruler,
      },
      {
        name: "FQC Dispatch Checklist",
        desc: "M7 — sign-offs before dispatch",
        href: "/quality/fqc",
        icon: PackageCheck,
      },
      {
        name: "Document Control",
        desc: "M9 — QMS annual review",
        href: "/quality/qms-docs",
        icon: ClipboardList,
      },
      {
        name: "NDT",
        desc: "Special-process vendors",
        href: "/reports/special-process-vendors",
        icon: FlaskConical,
      },
      {
        name: "NCR / MRB",
        desc: "Non-conformance board",
        href: "/mrb",
        icon: ClipboardX,
      },
      {
        name: "8D / CAPA",
        desc: "Problem solving",
        href: "/quality/8d",
        icon: FileCheck2,
      },
      {
        name: "PPAP & Control Plans",
        desc: "IATF evidence",
        href: "/quality/ppap",
        icon: ListChecks,
      },
      {
        name: "Gage R&R (MSA)",
        desc: "Measurement analysis",
        href: "/quality/grr",
        icon: Ruler,
      },
      {
        name: "Customer Quality",
        desc: "Complaints desk",
        href: "/commercial/desk",
        icon: AlertTriangle,
      },
      {
        name: "Customer Scorecards",
        desc: "M30 — our PPM / OTD as scored",
        href: "/commercial/scorecards",
        icon: Star,
      },
      {
        name: "QMS & Audits",
        desc: "ISO 9001 / AS9100",
        href: "/system/qms",
        icon: ClipboardList,
      },
      {
        name: "Management Review (MRM)",
        desc: "ISO 9001 cl.9.3 minutes",
        href: "/quality/mrm",
        icon: Presentation,
      },
      {
        name: "Quality Objectives",
        desc: "KPI targets vs live actuals",
        href: "/quality/objectives",
        icon: Target,
      },
      {
        name: "Cost of Quality",
        desc: "Scrap + rework + calib + warranty",
        href: "/quality/cost-of-quality",
        icon: BadgeIndianRupee,
      },
      {
        name: "Audit Readiness Pack",
        desc: "One-click ISO dossier",
        href: "/quality/audit-pack",
        icon: FileCheck2,
      },
    ],
  },
  {
    no: 5,
    id: "metrology",
    title: "Instrumentation / Metrology",
    short: "Metrology",
    desc: "Tool crib — master register, custody, calibration, quarantine.",
    icon: Gauge,
    gradient: "from-teal-400 to-cyan-600",
    glow: "rgba(45,212,191,0.35)",
    permissionKey: "metrology.view",
    hub: "/metrology",
    functions: [
      {
        name: "Instrument Master Register",
        desc: "All calibrated tools",
        href: "/system/admin?tab=metrology",
        icon: Gauge,
      },
      {
        name: "Calibration Scheduling",
        desc: "Due & expired",
        href: "/reports/calibration-register",
        icon: CalendarRange,
      },
      {
        name: "Quarantine Cage",
        desc: "Out-of-calibration",
        href: "/system/admin?tab=metrology",
        icon: AlertTriangle,
      },
      {
        name: "Gage R&R (MSA)",
        desc: "Measurement studies",
        href: "/quality/grr",
        icon: Ruler,
      },
      {
        name: "Cal Lab Procurement",
        desc: "Auto requisitions & lab ratings",
        href: "/supply/cal-lab",
        icon: FlaskConical,
      },
    ],
  },
  {
    no: 6,
    id: "supply",
    title: "Supply Chain & Materials",
    short: "Supply Chain",
    desc: "Procurement, suppliers, stores, inventory, EXIM.",
    icon: Truck,
    gradient: "from-amber-400 to-orange-600",
    glow: "rgba(245,158,11,0.35)",
    permissionKey: "supply.view",
    hub: "/supply/vault",
    functions: [
      {
        name: "Purchasing / Procurement",
        desc: "POs & suppliers",
        href: "/system/admin?tab=purchasing",
        icon: FileText,
      },
      {
        name: "Goods Receipt (GRN)",
        desc: "3-way match",
        href: "/supply/grn",
        icon: PackageCheck,
      },
      {
        name: "Stores & Warehousing",
        desc: "Inventory hub",
        href: "/supply/vault",
        icon: Package,
      },
      {
        name: "Fleet Logistics Radar",
        desc: "Real-time GPS shipment tracking",
        href: "/supply/fleet-radar",
        icon: Navigation,
      },
      {
        name: "AGV & AS/RS Intralogistics",
        desc: "Fleet routing & high-bay warehouse",
        href: "/digital-twin/agv",
        icon: Truck,
      },
      {
        name: "Inventory Control",
        desc: "Stock register",
        href: "/reports/stock-register",
        icon: Boxes,
      },
      {
        name: "MRP Planning Workbench",
        desc: "BOM explosion & planned orders",
        href: "/supply/mrp",
        icon: Layers,
      },
      {
        name: "Subcontracting & Special Process",
        desc: "Outward DCs & inward QC",
        href: "/supply/subcontracting",
        icon: Truck,
      },
      {
        name: "Supplier SQA",
        desc: "Scorecards & intelligence",
        href: "/supply/scorecards",
        icon: Star,
      },
      {
        name: "Supplier Intelligence",
        desc: "Data & trends",
        href: "/supply/intelligence",
        icon: Brain,
      },
      {
        name: "Reconcile",
        desc: "Stock reconciliation",
        href: "/supply/reconcile",
        icon: Boxes,
      },
      {
        name: "Cal Lab Procurement",
        desc: "Metrology→Supply requisitions",
        href: "/supply/cal-lab",
        icon: FlaskConical,
      },
      {
        name: "Buyer Board",
        desc: "Assign & chase requisitions",
        href: "/supply/buyer-board",
        icon: Users,
      },
      {
        name: "Cycle Count Program",
        desc: "ABC counts & stock adjust",
        href: "/supply/cycle-count",
        icon: Boxes,
      },
      {
        name: "Material Issue Slips",
        desc: "Issue RM to WOs",
        href: "/supply/material-issue",
        icon: PackageOpen,
      },
      {
        name: "Gate Pass",
        desc: "Dispatch & e-way control",
        href: "/supply/gate-pass",
        icon: ShieldCheck,
      },
      {
        name: "Bin Map",
        desc: "Stores location map",
        href: "/supply/bin-map",
        icon: Package,
      },
      {
        name: "Dead Stock & Write-offs",
        desc: "180d idle + finance write-off",
        href: "/supply/dead-stock",
        icon: Trash2,
      },
      {
        name: "PO Approval Chain",
        desc: "Manager / owner two-tier",
        href: "/supply/po-approvals",
        icon: ShieldCheck,
      },
      {
        name: "Comparative Quotes",
        desc: "Multi-supplier statements",
        href: "/supply/comparative",
        icon: Scale,
      },
      {
        name: "Rate Contracts",
        desc: "Annualised rates register",
        href: "/supply/rate-contracts",
        icon: BadgeIndianRupee,
      },
      {
        name: "Freight & Dispatch",
        desc: "Vendors, board & OTP scorecards",
        href: "/supply/freight",
        icon: Truck,
      },
      {
        name: "EXIM / Exports",
        desc: "Shipment register",
        href: "/commercial/exim",
        icon: Ship,
      },
    ],
  },
  {
    no: 7,
    id: "sales",
    title: "Sales & Marketing",
    short: "Sales",
    desc: "Quotations, order booking, marketing, export sales.",
    icon: LineChart,
    gradient: "from-sky-400 to-blue-600",
    glow: "rgba(56,189,248,0.35)",
    permissionKey: "commercial.view",
    hub: "/commercial/desk",
    functions: [
      {
        name: "Quotations & Estimation",
        desc: "Quotes & costing",
        href: "/commercial/quotations",
        icon: FileText,
      },
      {
        name: "Enquiry Funnel",
        desc: "Win rate & loss reasons",
        href: "/commercial/enquiry-funnel",
        icon: Filter,
      },
      {
        name: "Follow-up Cadence",
        desc: "Enquiry idle alerts & lost reasons",
        href: "/commercial/follow-ups",
        icon: BellRing,
      },
      {
        name: "Customer Exposure",
        desc: "Orders + receivables risk",
        href: "/commercial/customer-exposure",
        icon: ShieldAlert,
      },
      {
        name: "Price Revisions",
        desc: "Annual price register",
        href: "/commercial/price-revisions",
        icon: BadgeIndianRupee,
      },
      {
        name: "Order Booking & CRM",
        desc: "Sales desk",
        href: "/commercial/desk",
        icon: LineChart,
      },
      {
        name: "Marketing & Branding",
        desc: "Campaigns & leads",
        href: "/commercial/marketing",
        icon: Megaphone,
      },
      {
        name: "Export Sales",
        desc: "EXIM shipments",
        href: "/commercial/exim",
        icon: Ship,
      },
    ],
  },
  {
    no: 8,
    id: "finance",
    title: "Finance & Accounts",
    short: "Finance",
    desc: "Payables, receivables, costing, payroll, GST, treasury.",
    icon: Calculator,
    gradient: "from-emerald-400 to-teal-600",
    glow: "rgba(52,211,153,0.35)",
    permissionKey: "finance.view",
    hub: "/finance/hub",
    functions: [
      {
        name: "Accounts Payable",
        desc: "GRN & 3-way match",
        href: "/supply/grn",
        icon: PackageCheck,
      },
      {
        name: "Accounts Receivable",
        desc: "Receivables report",
        href: "/reports/receivables",
        icon: DollarSign,
      },
      {
        name: "Vouchers — Maker Checker",
        desc: "M17 — manager checks before posting",
        href: "/finance/vouchers",
        icon: ShieldCheck,
      },
      {
        name: "GST Reconciliation",
        desc: "2B vs purchase register",
        href: "/finance/gst-recon",
        icon: Scale,
      },
      {
        name: "Fixed Assets",
        desc: "Register + depreciation",
        href: "/finance/assets",
        icon: Landmark,
      },
      {
        name: "Collections",
        desc: "Aging, collectors & dunning",
        href: "/finance/collections",
        icon: HandCoins,
      },
      {
        name: "Job Costing & Profitability",
        desc: "Std vs actual variance",
        href: "/finance/costing",
        icon: BarChart3,
      },
      {
        name: "Payroll",
        desc: "Salary & payslips",
        href: "/people/payroll",
        icon: Wallet,
      },
      {
        name: "Taxation (GST)",
        desc: "Sales register & challan",
        href: "/reports/sales-register",
        icon: BadgeIndianRupee,
      },
      {
        name: "Treasury & Budget",
        desc: "Ledger & budget",
        href: "/commercial/treasury",
        icon: PiggyBank,
      },
      {
        name: "Dead Stock Write-offs",
        desc: "180d idle approvals",
        href: "/supply/dead-stock",
        icon: Trash2,
      },
    ],
  },
  {
    no: 9,
    id: "people",
    title: "Human Resources",
    short: "HR",
    desc: "Recruitment, training, time office, statutory compliance.",
    icon: Users,
    gradient: "from-indigo-400 to-violet-600",
    glow: "rgba(129,140,248,0.35)",
    permissionKey: "people.view",
    hub: "/people/pulse",
    functions: [
      {
        name: "Recruitment & Onboarding",
        desc: "Hiring pipeline",
        href: "/people/recruitment",
        icon: UserPlus,
      },
      {
        name: "Training Effectiveness",
        desc: "Post-check closes the record",
        href: "/people/training",
        icon: Trophy,
      },
      {
        name: "Time Office",
        desc: "Late / early / absent + OT register",
        href: "/people/time-office",
        icon: UserCircle,
      },
      {
        name: "Appraisals",
        desc: "Live-data performance",
        href: "/people/appraisals",
        icon: Award,
      },
      {
        name: "Overtime Approval",
        desc: "OT request → payroll",
        href: "/people/overtime",
        icon: Clock,
      },
      {
        name: "Grievances",
        desc: "Stage-tracked register",
        href: "/people/grievances",
        icon: Siren,
      },
      {
        name: "Disciplinary Register",
        desc: "Notice → hearing → decision",
        href: "/people/disciplinary",
        icon: Gavel,
      },
      {
        name: "Contract Labour (CLRA)",
        desc: "Register + licence renewals",
        href: "/people/clra",
        icon: HardHat,
      },
      {
        name: "HR Operations",
        desc: "Pulse & welfare",
        href: "/people/pulse",
        icon: Users,
      },
      {
        name: "Leaderboard",
        desc: "Gamified performance",
        href: "/people/leaderboard",
        icon: Trophy,
      },
      {
        name: "Statutory PF / ESI",
        desc: "Compliance register",
        href: "/people/statutory",
        icon: BadgeIndianRupee,
      },
    ],
  },
  {
    no: 10,
    id: "ehs",
    title: "EHS — Environment, Health & Safety",
    short: "EHS",
    desc: "Safety, occupational health, environment, fire response.",
    icon: Leaf,
    gradient: "from-lime-400 to-green-600",
    glow: "rgba(163,230,53,0.3)",
    permissionKey: "ehs.view",
    hub: "/ehs",
    functions: [
      {
        name: "Safety & Incidents",
        desc: "Incident investigation",
        href: "/system/safety",
        icon: AlertTriangle,
      },
      {
        name: "Permit to Work",
        desc: "Hot / height / confined permits",
        href: "/ehs/permits",
        icon: ShieldCheck,
      },
      {
        name: "Occupational Health",
        desc: "Health checks",
        href: "/system/ehs",
        icon: HeartPulse,
      },
      {
        name: "PPE Issue Register",
        desc: "M24 — issue & return per employee",
        href: "/ehs/ppe",
        icon: HardHat,
      },
      {
        name: "Chemical / MSDS Register",
        desc: "M24 — hazards & storage location",
        href: "/ehs/msds",
        icon: TestTube,
      },
      {
        name: "Consent Renewals",
        desc: "M25 — water / air consents → digest",
        href: "/ehs/consents",
        icon: Droplets,
      },
      {
        name: "Hazardous Waste",
        desc: "M25 — manifest & TSDF register",
        href: "/ehs/haz-waste",
        icon: Biohazard,
      },
      {
        name: "Extinguisher Map",
        desc: "M26 — locations + monthly checks",
        href: "/ehs/extinguishers",
        icon: Flame,
      },
      {
        name: "Environmental Compliance",
        desc: "Permits & records",
        href: "/system/ehs",
        icon: Leaf,
      },
      {
        name: "Fire & Emergency",
        desc: "Drills & response",
        href: "/system/ehs",
        icon: Zap,
      },
      {
        name: "5S",
        desc: "Workplace organisation",
        href: "/system/fives",
        icon: Sparkles,
      },
      {
        name: "Kaizen",
        desc: "Continuous improvement",
        href: "/system/kaizen",
        icon: TrendingUp,
      },
      {
        name: "Idea Box",
        desc: "Employee ideas",
        href: "/system/ideas",
        icon: Lightbulb,
      },
      {
        name: "Lean Program",
        desc: "Lean toolkit",
        href: "/system/lean",
        icon: LineChart,
      },
    ],
  },
  {
    no: 11,
    id: "maintenance",
    title: "Maintenance & Utilities",
    short: "Maintenance",
    desc: "Breakdown, preventive maintenance, utilities, spares.",
    icon: Wrench,
    gradient: "from-orange-400 to-red-600",
    glow: "rgba(251,146,60,0.35)",
    permissionKey: "maintenance.view",
    hub: "/maintenance",
    functions: [
      {
        name: "Breakdown Maintenance",
        desc: "Job board",
        href: "/system/maintenance",
        icon: Wrench,
      },
      {
        name: "Reliability — MTBF/MTTR",
        desc: "Failure analytics",
        href: "/maintenance/reliability",
        icon: Activity,
      },
      {
        name: "Predictive Maintenance (RUL)",
        desc: "Spindle health forecasting",
        href: "/maintenance/predictive",
        icon: CalendarClock,
      },
      {
        name: "Spares ABC/VED",
        desc: "M27 — classification & reorder points",
        href: "/maintenance/spares-abc",
        icon: Boxes,
      },
      {
        name: "Preventive / Predictive",
        desc: "PM schedule",
        href: "/system/maintenance",
        icon: CalendarRange,
      },
      {
        name: "Utilities Log",
        desc: "M28 — power / compressor daily KPIs",
        href: "/maintenance/utilities",
        icon: Zap,
      },
      {
        name: "Utilities",
        desc: "Power, air, HVAC",
        href: "/system/utilities",
        icon: Zap,
      },
      {
        name: "Spares Management",
        desc: "Spare parts",
        href: "/supply/spares",
        icon: Cog,
      },
    ],
  },
  {
    no: 12,
    id: "projects",
    title: "Projects / Program Management",
    short: "Projects",
    desc: "Aero/defence programs, customer coordination, contracts.",
    icon: FolderKanban,
    gradient: "from-fuchsia-400 to-purple-600",
    glow: "rgba(232,121,249,0.35)",
    permissionKey: "projects.view",
    hub: "/projects",
    functions: [
      {
        name: "Program Planning",
        desc: "Projects board",
        href: "/projects",
        icon: FolderKanban,
      },
      {
        name: "Milestone Doc Packs",
        desc: "M29 — deliverables gate invoicing",
        href: "/projects/milestones",
        icon: ClipboardCheck,
      },
      {
        name: "Customer Coordination",
        desc: "Program tracking",
        href: "/projects",
        icon: Users,
      },
      {
        name: "Contract Management",
        desc: "Contracts register",
        href: "/projects/contracts",
        icon: FileSignature,
      },
    ],
  },
  {
    no: 13,
    id: "it",
    title: "IT & Systems",
    short: "IT & Systems",
    desc: "ERP/MES admin, infrastructure, cybersecurity, backups.",
    icon: Cpu,
    gradient: "from-rose-400 to-pink-600",
    glow: "rgba(251,113,133,0.35)",
    permissionKey: "system.view",
    hub: "/system",
    functions: [
      {
        name: "ERP / MES Administration",
        desc: "Settings & master data",
        href: "/system/admin",
        icon: Cog,
      },
      {
        name: "IT Assets",
        desc: "M31 — register & assignment",
        href: "/system/it-assets",
        icon: Monitor,
      },
      {
        name: "IT Tickets",
        desc: "M31 — SLA-timed service desk",
        href: "/system/tickets",
        icon: Ticket,
      },
      {
        name: "Infrastructure & Networks",
        desc: "Assets & health",
        href: "/system/infrastructure",
        icon: Server,
      },
      {
        name: "Cybersecurity & Access",
        desc: "Users & roles",
        href: "/system/admin?tab=users",
        icon: ShieldCheck,
      },
      {
        name: "Access Review",
        desc: "Quarterly certifications",
        href: "/system/access-review",
        icon: ShieldCheck,
      },
      {
        name: "Unified Namespace (UNS)",
        desc: "ISA-95 IIoT topic hierarchy",
        href: "/iot/uns",
        icon: FolderTree,
      },
      {
        name: "Live Sensor Telemetry",
        desc: "Real-time waveform historian",
        href: "/iot/telemetry",
        icon: Activity,
      },
      {
        name: "Edge Gateway (UMH)",
        desc: "Benthos & MQTT broker bridge",
        href: "/iot/gateway",
        icon: Radio,
      },
      {
        name: "Visual Flow Studio",
        desc: "Node-RED automation engine",
        href: "/automation/flows",
        icon: Workflow,
      },
      {
        name: "Edge Event Debug Wire",
        desc: "Real-time rule execution",
        href: "/automation/debug",
        icon: Terminal,
      },
      {
        name: "Automation Recipes",
        desc: "Industrial edge rules",
        href: "/automation/recipes",
        icon: Sparkles,
      },
      {
        name: "MQTT Sparkplug B Manager",
        desc: "AMRC Factory+ protocol",
        href: "/factoryplus/sparkplug",
        icon: Radio,
      },
      {
        name: "Factory+ Asset Directory",
        desc: "UUID-indexed device registry",
        href: "/factoryplus/directory",
        icon: FolderTree,
      },
      {
        name: "Industrial Schema Validator",
        desc: "JSON schema metric engine",
        href: "/factoryplus/schemas",
        icon: FileCode2,
      },
      {
        name: "Shopfloor AI Copilot",
        desc: "Factory intelligence assistant",
        href: "/ai/assistant",
        icon: Sparkles,
      },
      {
        name: "Autonomous Multi-Agent Hub",
        desc: "Goal-driven specialized agents",
        href: "/ai/agents",
        icon: Bot,
      },
      {
        name: "Synthetic E2E Tester",
        desc: "Automated factory pipeline suite",
        href: "/system/synthetics",
        icon: Zap,
      },
      {
        name: "Spec Kit & SDD Contracts",
        desc: "GitHub Spec Kit SDD engine",
        href: "/system/speckit",
        icon: FileCode2,
      },
      {
        name: "Data & Backups",
        desc: "Backup jobs",
        href: "/system/infrastructure",
        icon: FolderOpen,
      },
      {
        name: "System Health",
        desc: "Uptime, DB, disk & LAN",
        href: "/system/health",
        icon: HeartPulse,
      },
      {
        name: "Data Import",
        desc: "Bulk CSV import",
        href: "/system/import",
        icon: FileUp,
      },
    ],
  },
];

// Permission key -> department lookup for contextual login
export const PERMISSION_TO_DEPT: Record<string, string> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.permissionKey, d.id]),
);

// Route -> permission key map (for server-side redirect permission checks)
export const HUB_TO_PERMISSION: Record<string, string> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.hub, d.permissionKey]),
);

// Map a BudgetLine.department display name ("Production", "Quality", …) to a
// departments.ts id via id / title / short, so hubs and bells can scope by dept.
export function matchDepartmentKey(name: string): string | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  for (const d of DEPARTMENTS) {
    if (
      d.id === name ||
      d.title.toLowerCase() === n ||
      d.short.toLowerCase() === n ||
      d.title.toLowerCase().split("/")[0].trim() === n
    ) {
      return d.id;
    }
  }
  for (const d of DEPARTMENTS) {
    if (d.title.toLowerCase().split(/[\s/]/)[0] === n) return d.id;
  }
  return null;
}

export function departmentById(id: string): Department | undefined {
  return DEPARTMENTS.find((d) => d.id === id);
}

// Resolve a route path to the department permission that gates it
export function permissionForPath(path: string): string | null {
  const sorted = [...DEPARTMENTS].sort((a, b) => b.hub.length - a.hub.length);
  for (const d of sorted) {
    if (
      path === d.hub ||
      path.startsWith(d.hub + "/") ||
      path.startsWith(d.hub + "?")
    ) {
      return d.permissionKey;
    }
  }
  // Sub-function pages that don't start with a hub path — map by exact sub-function href
  for (const d of DEPARTMENTS) {
    for (const f of d.functions) {
      const href = f.href.split("?")[0];
      if (path === href || path.startsWith(href + "/")) return d.permissionKey;
    }
  }
  return null;
}
