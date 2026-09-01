"use client";

import { useState } from "react";
import { Search, Sparkles, Check } from "lucide-react";
import { soundFx } from "@/lib/soundFx";

export interface EnterpriseRoleTemplate {
  id: string;
  department: string;
  deptId: string;
  title: string;
  level: "EXECUTIVE" | "MANAGEMENT" | "SPECIALIST" | "OPERATOR";
  summary: string;
  permissions: string[];
  modules: string[];
  approvalScope: string;
}

export const ENTERPRISE_ROLES: EnterpriseRoleTemplate[] = [
  // 1. EXECUTIVE
  {
    id: "exec_owner",
    department: "Executive Command",
    deptId: "exec",
    title: "Managing Director / Plant Owner",
    level: "EXECUTIVE",
    summary: "Full enterprise ownership, strategic capital expenditure, corporate governance, and final financial authority.",
    permissions: ["*"],
    modules: ["Executive Briefing (/reports/executive-briefing)", "Plant Profitability (/reports/profitability)", "Investor Simulator (/system/investors)", "System Admin (/system/admin)"],
    approvalScope: "Full enterprise wildcard, CapEx > $100k, company policy sign-off",
  },
  {
    id: "exec_gm",
    department: "Executive Command",
    deptId: "exec",
    title: "General Manager / Plant Head",
    level: "EXECUTIVE",
    summary: "Multi-department plant orchestration, daily OEE realization, statutory compliance, and budget delivery.",
    permissions: ["ops.approve", "quality.approve", "supply.approve", "finance.approve", "people.approve", "exec.view", "exec.edit", "kpi.override"],
    modules: ["Morning Pack (/reports/morning-pack)", "3D Floor Gateway (/)", "Capacity Radar (/reports/capacity)", "Department Directory (/departments)"],
    approvalScope: "Cross-department work orders, major scrap write-offs, supplier rate contracts",
  },

  // 2. OPERATIONS & PPC
  {
    id: "ops_ppc_mgr",
    department: "Operations & PPC",
    deptId: "ops",
    title: "PPC & Scheduling Manager",
    level: "MANAGEMENT",
    summary: "Master production scheduling (MPS), capacity balancing, traveler routing, and on-time dispatch.",
    permissions: ["ops.view", "ops.edit", "ops.approve", "engineering.view", "supply.view", "reports.print"],
    modules: ["Work Orders (/ops/work-orders)", "Production Schedule (/ops/schedule)", "Visual Kanban (/ops/kanban)", "Travelers (/reports/traveler)"],
    approvalScope: "Work order release, batch splitting, machine reassignment, schedule sequence overrides",
  },
  {
    id: "ops_supervisor",
    department: "Operations & PPC",
    deptId: "ops",
    title: "Shift Production Supervisor",
    level: "SPECIALIST",
    summary: "Shift output execution, operator line balancing, downtime logging, and shift-to-shift handover.",
    permissions: ["ops.view", "ops.edit", "people.view", "quality.view", "reports.print"],
    modules: ["Shift Roster (/ops/roster)", "Shift Handover (/people/handover)", "Andon Board (/ops/andon)", "Scrap/Rework (/ops/scrap)"],
    approvalScope: "Shift piece counts, break approvals, preliminary downtime reason assignment",
  },
  {
    id: "ops_operator",
    department: "Operations & PPC",
    deptId: "ops",
    title: "CNC Machine Operator / Machinist",
    level: "OPERATOR",
    summary: "Safe machine operation, cycle time adherence, piece counting, in-cycle QC checks, and tool wear reporting.",
    permissions: ["terminal.use", "ops.view"],
    modules: ["Tablet Kiosk (/terminal)", "Operator View (/ops/kiosk)", "Voice Assistant (/ops/voice)", "Idea Box (/system/ideas)"],
    approvalScope: "Self piece-count punch, tool wear flag",
  },

  // 3. QUALITY & METROLOGY
  {
    id: "qa_head",
    department: "Quality Assurance & Metrology",
    deptId: "quality",
    title: "Head of Quality / QMR (AS9100/IATF)",
    level: "MANAGEMENT",
    summary: "QMS document control, customer registrar audits, quality policy targets, and MRM governance.",
    permissions: ["quality.view", "quality.edit", "quality.approve", "audit.view", "metrology.edit", "records.edit"],
    modules: ["QMS Docs (/quality/qms-docs)", "Audit Packs (/quality/audit-pack)", "Management Review (/quality/mrm)", "COPQ (/quality/cost-of-quality)"],
    approvalScope: "Customer PPAP / PSW sign-off, MRB final disposition, internal audit release, CAR closure",
  },
  {
    id: "qa_engineer",
    department: "Quality Assurance & Metrology",
    deptId: "quality",
    title: "Quality & Metrology Engineer",
    level: "SPECIALIST",
    summary: "Statistical Process Control (Cp/Cpk), First Article AS9102, CMM verification, and Gage R&R.",
    permissions: ["quality.view", "quality.edit", "metrology.view", "metrology.edit", "reports.print"],
    modules: ["SPC Charts (/quality/spc-charts)", "Gage R&R (/quality/grr)", "First Article (/reports/fai/[id])", "Material Certs (/reports/material-certs)"],
    approvalScope: "First piece clearance, gage calibration validation, FAI characteristic acceptance",
  },
  {
    id: "qc_inspector",
    department: "Quality Assurance & Metrology",
    deptId: "quality",
    title: "QC Line / Inward Inspector",
    level: "OPERATOR",
    summary: "Goods-inward checks, floor roving sampling, final inspection check sheets, and non-conformance quarantine.",
    permissions: ["quality.view", "quality.edit", "ops.view"],
    modules: ["Inward IQC (/quality/iqc)", "In-Process IPQC (/quality/ipqc)", "Final FQC (/quality/fqc)", "MRB Quarantine (/reports/mrb)"],
    approvalScope: "Lot acceptance, quarantine tag placement, stage gate sign-off",
  },

  // 4. SUPPLY CHAIN & WAREHOUSE
  {
    id: "scm_head",
    department: "Supply Chain & Warehouse",
    deptId: "supply",
    title: "Supply Chain Head / Materials Director",
    level: "MANAGEMENT",
    summary: "End-to-end supply chain orchestration, vendor rating contracts, MRP policy, and inventory valuation.",
    permissions: ["supply.view", "supply.edit", "supply.approve", "commercial.view", "reports.print"],
    modules: ["MRP Engine (/supply/mrp)", "Supplier Scorecards (/supply/scorecards)", "Inventory Valuation (/reports/inventory-valuation)", "Fleet Radar (/supply/fleet-radar)"],
    approvalScope: "PO approvals > $10k, vendor onboarding, blanket contracts",
  },
  {
    id: "scm_buyer",
    department: "Supply Chain & Warehouse",
    deptId: "supply",
    title: "Procurement Officer / Buyer",
    level: "SPECIALIST",
    summary: "PO issuance, vendor expediting, RFQ comparative processing, and rate reconciliation.",
    permissions: ["supply.view", "supply.edit", "supply.approve"],
    modules: ["Buyer Board (/supply/buyer-board)", "PO Approvals (/supply/po-approvals)", "PO Register (/reports/po-register)", "Subcontracting (/supply/subcontracting)"],
    approvalScope: "Standard PO issuance within budgeted MRP deficits",
  },
  {
    id: "scm_stores",
    department: "Supply Chain & Warehouse",
    deptId: "supply",
    title: "Stores & Warehouse Manager",
    level: "SPECIALIST",
    summary: "Stock accuracy, bin management, GRN inwarding, cycle counting, and BOM material issuance.",
    permissions: ["supply.view", "supply.edit", "ops.view", "reports.print"],
    modules: ["GRN Inwarding (/supply/grn)", "Visual Bin Map (/supply/bin-map)", "Material Issue (/supply/material-issue)", "Cycle Count (/supply/cycle-count)"],
    approvalScope: "Physical stock adjustments, store gate-pass release, scrap yard disposal",
  },

  // 5. ENGINEERING & CAM/R&D
  {
    id: "eng_lead",
    department: "Engineering, R&D & Design",
    deptId: "engineering",
    title: "Lead Process & Design Engineer",
    level: "MANAGEMENT",
    summary: "Manufacturing process routing, BOM architecture, CAD/CAM models, tooling fixtures, and ECOs.",
    permissions: ["engineering.view", "engineering.edit", "engineering.approve", "ops.view", "quality.view"],
    modules: ["ECO Register (/reports/eco-register)", "R&D Powder Log (/rnd/powder-log)", "SOPs (/ops/sop)", "Special Vendors (/reports/special-process-vendors)"],
    approvalScope: "EBOM to MBOM releases, cycle time standard revisions, ECO authorization",
  },
  {
    id: "eng_cam",
    department: "Engineering, R&D & Design",
    deptId: "engineering",
    title: "CNC / CAM Programmer",
    level: "SPECIALIST",
    summary: "Multi-axis NC toolpath generation, cutting tool selection, and toolroom offset management.",
    permissions: ["engineering.view", "ops.view", "supply.view"],
    modules: ["Tool Room (/ops/tool-room)", "Machine Details (/system/machines/[machineId])", "Work Order Characteristics (/ops/work-orders/[id])"],
    approvalScope: "NC program release freeze, tool life parameter overrides",
  },

  // 6. MAINTENANCE & UTILITIES
  {
    id: "maint_mgr",
    department: "Maintenance & Plant Utilities",
    deptId: "maintenance",
    title: "Maintenance & Plant Engineering Manager",
    level: "MANAGEMENT",
    summary: "Machine uptime (OEE Availability), MTBF/MTTR optimization, PM schedules, and critical spares.",
    permissions: ["maintenance.view", "maintenance.edit", "maintenance.approve", "system.view", "ops.view"],
    modules: ["Maintenance Hub (/system/maintenance)", "Machine Telemetry (/system/machines)", "Machine History (/reports/machine-history)", "Spares (/supply/spares)"],
    approvalScope: "PM completion sign-off, emergency breakdown work orders, capital overhaul approvals",
  },

  // 7. COMMERCIAL & SALES
  {
    id: "comm_head",
    department: "Commercial & Sales",
    deptId: "commercial",
    title: "Commercial Head / VP Sales",
    level: "MANAGEMENT",
    summary: "Customer sales pipeline, contract review (AS9100 clause 8.2), quote profitability, and dunning.",
    permissions: ["commercial.view", "commercial.edit", "commercial.approve", "finance.view", "reports.print"],
    modules: ["Commercial Hub (/commercial)", "Sales Register (/reports/sales-register)", "EXIM Compliance (/reports/exim)", "Contracts (/projects/contracts)"],
    approvalScope: "Customer quotations, discounts, contract commitments, credit terms",
  },

  // 8. FINANCE & COST ACCOUNTING
  {
    id: "fin_head",
    department: "Finance & Cost Accounting",
    deptId: "finance",
    title: "Finance Controller / Chief Accountant",
    level: "MANAGEMENT",
    summary: "Financial books of account, cash flow forecasting, GSTR-2B reconciliation, Capex, and audit.",
    permissions: ["finance.view", "finance.edit", "finance.approve", "commercial.view", "reports.print"],
    modules: ["Finance Dashboard (/finance)", "Accounts Receivable (/reports/receivables)", "Supplier Payables (/reports/supplier-payables)", "PF/ESI Challans (/reports/pf-esi-challan)"],
    approvalScope: "Supplier payment vouchers, customer credit adjustments, bank reconciliation release",
  },

  // 9. PEOPLE & HR
  {
    id: "hr_head",
    department: "People, HR & Time Office",
    deptId: "people",
    title: "HR & Industrial Relations Head",
    level: "MANAGEMENT",
    summary: "Workforce headcount, statutory labor compliance (CLRA, Factories Act), appraisals, and grievances.",
    permissions: ["people.view", "people.edit", "people.approve", "reports.print"],
    modules: ["People Hub (/people)", "Appraisals (/people/appraisals)", "Disciplinary Actions (/people/disciplinary)", "CLRA Compliance (/people/clra)"],
    approvalScope: "Employee onboarding/exit, performance appraisals, wage increments, disciplinary notices",
  },
  {
    id: "hr_time_office",
    department: "People, HR & Time Office",
    deptId: "people",
    title: "Time Office & Payroll Executive",
    level: "SPECIALIST",
    summary: "Biometric punch sync, shift attendance, overtime calculation (50-hr statutory limit), and payroll slips.",
    permissions: ["people.view", "people.edit", "reports.print"],
    modules: ["Attendance (/people/attendance)", "Overtime Register (/reports/ot-register)", "Payroll (/people/payroll)", "Leave Register (/reports/leave-register)"],
    approvalScope: "OT hour verification, monthly attendance freeze for payroll processing",
  },

  // 10. EHS & SAFETY
  {
    id: "ehs_officer",
    department: "EHS & Environmental Safety",
    deptId: "ehs",
    title: "EHS Safety & Sustainability Officer",
    level: "SPECIALIST",
    summary: "Zero-harm safety culture, accident investigations, ISO 14001 / ISO 45001, and work permits.",
    permissions: ["ehs.view", "ehs.edit", "ehs.approve", "sustainability.view", "system.view"],
    modules: ["EHS Incidents (/system/ehs)", "Safety Hub (/system/safety)", "Hazardous Maps (/system/utilities)", "ESG Carbon (/system/sustainability)"],
    approvalScope: "Critical work permits (Hot Work, Height), machine safety stoppage, incident sign-off",
  },

  // 11. CONTINUOUS IMPROVEMENT & SIX SIGMA
  {
    id: "ci_black_belt",
    department: "Continuous Improvement & Six Sigma",
    deptId: "system",
    title: "Operational Excellence & Six Sigma Black Belt Lead",
    level: "MANAGEMENT",
    summary: "Factory-wide productivity, Kaizen blitzes, 5S workplace audits, DMAIC project execution, and DPMO tracking.",
    permissions: ["system.view", "system.edit", "ops.view", "quality.view", "kpi.override"],
    modules: ["Lean & Six Sigma (/system/lean)", "Kaizen Hub (/system/kaizen)", "5S Audits (/system/fives)", "Pareto Loss Radar (/reports/pareto)"],
    approvalScope: "Kaizen reward authorization, DMAIC phase-gate sign-offs, 5S audit scoring",
  },

  // 12. IT & IOT SYSTEMS
  {
    id: "it_admin",
    department: "IT, Security & IoT Systems",
    deptId: "system",
    title: "IT Systems & Security Administrator",
    level: "MANAGEMENT",
    summary: "User provisioning, RBAC role assignment, cloud/local database backup rotations, and audit trail logs.",
    permissions: ["users.manage", "system.view", "system.edit", "audit.view"],
    modules: ["User Roles (/system/roles)", "Access Review (/system/access-review)", "AI Gateway (/system/ai)", "Audit Trails (/reports/audit-register)"],
    approvalScope: "User role provisioning, session revocation, database backup exports, API key configurations",
  },
];

interface EnterpriseRolesDirectoryProps {
  onSelectTemplate?: (template: EnterpriseRoleTemplate) => void;
}

export default function EnterpriseRolesDirectory({
  onSelectTemplate,
}: EnterpriseRolesDirectoryProps) {
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const departments = ["ALL", ...Array.from(new Set(ENTERPRISE_ROLES.map((r) => r.department)))];

  const filteredRoles = ENTERPRISE_ROLES.filter((r) => {
    const matchesDept = selectedDept === "ALL" || r.department === selectedDept;
    const matchesSearch =
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.summary.toLowerCase().includes(search.toLowerCase()) ||
      r.department.toLowerCase().includes(search.toLowerCase()) ||
      r.permissions.some((p) => p.toLowerCase().includes(search.toLowerCase()));
    return matchesDept && matchesSearch;
  });

  const handleApplyTemplate = (role: EnterpriseRoleTemplate) => {
    soundFx.playSuccess();
    setCopiedId(role.id);
    setTimeout(() => setCopiedId(null), 2000);
    onSelectTemplate?.(role);
  };

  return (
    <div className="space-y-6">
      {/* SEARCH AND FILTER BAR */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roles by title, department, or permission keys..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 text-xs font-medium focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="px-3.5 py-2.5 rounded-2xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
        >
          {departments.map((dept) => (
            <option key={dept} value={dept}>
              {dept === "ALL" ? "All 13 Departments" : dept}
            </option>
          ))}
        </select>
      </div>

      {/* ROLES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRoles.map((role) => {
          const isCopied = copiedId === role.id;
          return (
            <div
              key={role.id}
              className="p-5 rounded-3xl glass-card border border-slate-700 hover:border-blue-500/50 transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        {role.department}
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          role.level === "EXECUTIVE"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : role.level === "MANAGEMENT"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            : role.level === "SPECIALIST"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {role.level}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-1.5 group-hover:text-blue-400 transition-colors">
                      {role.title}
                    </h3>
                  </div>

                  {onSelectTemplate && (
                    <button
                      onClick={() => handleApplyTemplate(role)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        isCopied
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40"
                      }`}
                      title="Instantiate this role template with pre-filled permissions"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Applied!</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                          <span>Use Template</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {role.summary}
                </p>

                {/* PERMISSION BADGES */}
                <div className="space-y-1.5 border-t border-slate-800 pt-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    Recommended Permissions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {role.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-900 text-cyan-300 border border-slate-800"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>

                {/* APPROVAL SCOPE */}
                <div className="text-[11px] text-slate-400 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="font-bold text-slate-300">Approval Scope: </span>
                  {role.approvalScope}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
