/**
 * Organizational role catalog - the complete set of roles a real plant runs,
 * grouped by department, each with a grade ladder and the permission bundle
 * it needs. Pure data + helpers (no prisma import) so it can be unit-tested
 * and seeded.
 *
 * Role codes are stable identifiers (e.g. QC-QE-SUPPLIER). Grade ladders are
 * a subset of TRAINEE -> JUNIOR -> SENIOR -> LEAD (a role with no ladder is a
 * single-grade role like a manager or operator). Permission bundles reuse the
 * existing keys from ./permissions - "junior drafts, senior approves" falls
 * out of grades once grade-gating lands (backlog T2-1/T3-3).
 */

export type Grade = "TRAINEE" | "JUNIOR" | "SENIOR" | "LEAD";
export const GRADE_LADDER: Grade[] = ["TRAINEE", "JUNIOR", "SENIOR", "LEAD"];

export interface CatalogRole {
  code: string; // unique stable id - seeded as the Role.name
  title: string;
  department: string; // workspace domain key: ops | supply | commercial | ... | exec
  discipline: string; // e.g. "Quality Engineering" - many roles share one discipline
  description: string;
  grades?: Grade[]; // ladder if grade-gated, absent for single-grade roles
  perms: string[]; // existing permission keys
}

// ---- helpers -------------------------------------------------------------
const V = (d: string) => `${d}.view`;
const E = (d: string) => `${d}.edit`;
const A = (d: string) => `${d}.approve`;

// ---- the catalog ---------------------------------------------------------
export const ROLE_CATALOG: CatalogRole[] = [
  // ==== EXEC ====
  {
    code: "EXEC-OWNER",
    title: "Owner / Director",
    department: "exec",
    discipline: "Executive",
    description: "Strategic, statutory and board accountability.",
    perms: ["exec.view", "exec.edit", "exec.approve", "audit.view", "users.manage", "kpi.override", ...allDomainViews(), ...allDomainApproves()],
  },
  {
    code: "EXEC-PLANT-HEAD",
    title: "Plant Head / GM",
    department: "exec",
    discipline: "Executive",
    description: "Runs the plant - P&L, production vs plan, quality, cost, people.",
    perms: ["exec.view", "exec.edit", "exec.approve", ...allDomainViews()],
  },

  // ==== OPS / PRODUCTION ====
  {
    code: "OPS-PROD-MGR",
    title: "Production Manager",
    department: "ops",
    discipline: "Production",
    description: "Plan adherence, output, manpower, OEE ownership, gate releases.",
    perms: [V("ops"), E("ops"), A("ops"), V("supply"), V("quality"), V("maintenance")],
  },
  {
    code: "OPS-PPC",
    title: "PPC / Planner",
    department: "ops",
    discipline: "Planning",
    description: "Order book vs capacity, material planning, WO release scheduling.",
    perms: [V("ops"), E("ops"), V("supply"), V("commercial")],
  },
  {
    code: "OPS-IE",
    title: "Methods / IE Engineer",
    department: "ops",
    discipline: "Industrial Engineering",
    description: "Time studies, standard times, lean observations, work instructions.",
    grades: ["TRAINEE", "JUNIOR", "SENIOR", "LEAD"],
    perms: [V("ops"), E("ops"), V("engineering"), V("quality")],
  },
  {
    code: "OPS-SUPERVISOR",
    title: "Shift Supervisor",
    department: "ops",
    discipline: "Production",
    description: "Runs the shift: machines, disputes, approvals, attendance.",
    perms: [V("ops"), E("ops"), A("ops"), "records.edit", "terminal.use"],
  },
  {
    code: "OPS-OPERATOR",
    title: "Machine Operator",
    department: "ops",
    discipline: "Production",
    description: "Runs jobs, logs production/downtime, clock-in, checklists.",
    grades: ["TRAINEE", "JUNIOR", "SENIOR"],
    perms: ["terminal.use", V("ops")],
  },

  // ==== QUALITY ====
  {
    code: "QC-HEAD",
    title: "Quality Head / Manager",
    department: "quality",
    discipline: "Quality",
    description: "QMS ownership, MRM, objectives, audits, escapes, supplier quality.",
    perms: [V("quality"), E("quality"), A("quality"), V("metrology"), V("engineering"), "audit.view"],
  },
  {
    code: "QC-QE-SUPPLIER",
    title: "Supplier Quality Engineer",
    department: "quality",
    discipline: "Quality Engineering",
    description: "Supplier NCRs, PPAP approvals, source inspection, supplier audits.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("quality"), E("quality"), V("supply")],
  },
  {
    code: "QC-QE-PROCESS",
    title: "Process Quality Engineer",
    department: "quality",
    discipline: "Quality Engineering",
    description: "In-process controls, control plans, SPC, defect reduction.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("quality"), E("quality"), V("ops")],
  },
  {
    code: "QC-QE-CUSTOMER",
    title: "Customer Quality Engineer",
    department: "quality",
    discipline: "Quality Engineering",
    description: "8D leadership, complaint SLA, customer scorecards, escapes.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("quality"), E("quality"), V("commercial"), "audit.view"],
  },
  {
    code: "QC-INSPECTOR",
    title: "Inspector (IQC / IPQC / FQC)",
    department: "quality",
    discipline: "Inspection",
    description: "AQL sampling, in-process checks, dispatch checklist, hold points.",
    perms: [V("quality"), "terminal.use"],
  },
  {
    code: "QC-CMM",
    title: "CMM Programmer",
    department: "quality",
    discipline: "Metrology",
    description: "CMM programs, first-off validation, complex geometry measurement.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("quality"), V("metrology")],
  },
  {
    code: "QC-NDT",
    title: "NDT Technician",
    department: "quality",
    discipline: "Non-destructive Testing",
    description: "Penetrant/ultrasonic/magnetic inspection, NDT records.",
    grades: ["TRAINEE", "JUNIOR", "SENIOR"],
    perms: [V("quality")],
  },
  {
    code: "QC-DOC-CTRL",
    title: "Document Controller",
    department: "quality",
    discipline: "QMS",
    description: "QMS document register, revisions, transmittals, records control.",
    perms: [V("quality"), E("quality")],
  },
  {
    code: "QC-AUDITOR",
    title: "Internal Auditor",
    department: "quality",
    discipline: "QMS",
    description: "QMS + process audits, findings, CAPA follow-up.",
    grades: ["JUNIOR", "SENIOR"],
    perms: ["audit.view", V("quality"), V("ops"), V("supply"), V("engineering")],
  },

  // ==== SUPPLY ====
  {
    code: "SUP-HEAD",
    title: "SCM Head",
    department: "supply",
    discipline: "Supply Chain",
    description: "Sourcing strategy, supplier performance, rate contracts, risk.",
    perms: [V("supply"), E("supply"), A("supply"), V("quality"), V("finance")],
  },
  {
    code: "SUP-BUYER",
    title: "Buyer",
    department: "supply",
    discipline: "Procurement",
    description: "Requisition to PO, negotiation, comparative awards within limits.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("supply"), E("supply")],
  },
  {
    code: "SUP-EXPEDITOR",
    title: "Expeditor / PO Follow-up",
    department: "supply",
    discipline: "Procurement",
    description: "PO follow-ups, delivery chasing, buyer-board escalations.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("supply")],
  },
  {
    code: "SUP-STORE",
    title: "Storekeeper",
    department: "supply",
    discipline: "Stores",
    description: "Receipt, binning, issue, cycle count, dead stock.",
    perms: [V("supply"), E("supply")],
  },
  {
    code: "SUP-FREIGHT",
    title: "Freight / EXIM Coordinator",
    department: "supply",
    discipline: "Logistics",
    description: "Dispatch booking, freight scoring, EXIM milestones, gate pass.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("supply"), E("supply"), V("commercial")],
  },
  {
    code: "SUP-INSPECT-REC",
    title: "Receiving / GRN Clerk",
    department: "supply",
    discipline: "Stores",
    description: "Goods receipt entry, packing slips, 3-way match documents.",
    grades: ["TRAINEE", "JUNIOR", "SENIOR"],
    perms: [V("supply"), E("supply")],
  },

  // ==== MAINTENANCE ====
  {
    code: "MAINT-HEAD",
    title: "Maintenance Head",
    department: "maintenance",
    discipline: "Maintenance",
    description: "MTBF/MTTR, RCA discipline, PM compliance, spares budget.",
    perms: [V("maintenance"), E("maintenance"), A("maintenance"), V("ops")],
  },
  {
    code: "MAINT-ENG",
    title: "Maintenance Engineer",
    department: "maintenance",
    discipline: "Maintenance",
    description: "PM execution, breakdown RCA + countermeasure, job close.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("maintenance"), E("maintenance"), V("ops")],
  },
  {
    code: "MAINT-TECH",
    title: "Maintenance Technician",
    department: "maintenance",
    discipline: "Maintenance",
    description: "PM execution, breakdown response, spare requests.",
    grades: ["TRAINEE", "JUNIOR", "SENIOR"],
    perms: [V("maintenance")],
  },
  {
    code: "MAINT-TOOLROOM",
    title: "Tool-Room Keeper",
    department: "maintenance",
    discipline: "Tooling",
    description: "Tool/fixture issue, regrind, scrap decisions, instrument issue.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("maintenance"), E("maintenance"), V("metrology")],
  },

  // ==== COMMERCIAL ====
  {
    code: "COMM-SALES-MGR",
    title: "Sales Manager",
    department: "commercial",
    discipline: "Sales",
    description: "Pipeline, discount approvals, price revisions, collections.",
    perms: [V("commercial"), E("commercial"), A("commercial"), V("finance")],
  },
  {
    code: "COMM-SALES-EXEC",
    title: "Sales Executive",
    department: "commercial",
    discipline: "Sales",
    description: "Lead capture, quotations, follow-ups, win/loss analysis.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("commercial"), E("commercial")],
  },
  {
    code: "COMM-MARKETING",
    title: "Marketing Executive",
    department: "commercial",
    discipline: "Marketing",
    description: "Campaigns, landing content, lead generation, branding.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("commercial"), E("commercial"), V("brand"), E("brand")],
  },
  {
    code: "COMM-ACCOUNTS",
    title: "Key Account Manager",
    department: "commercial",
    discipline: "Sales",
    description: "Named accounts, exposure, contract negotiations.",
    grades: ["SENIOR", "LEAD"],
    perms: [V("commercial"), E("commercial"), V("projects")],
  },

  // ==== FINANCE ====
  {
    code: "FIN-HEAD",
    title: "CFO / Finance Head",
    department: "finance",
    discipline: "Finance",
    description: "Books, statutory compliance, treasury, budget, risk, board pack.",
    perms: [V("finance"), E("finance"), A("finance"), V("exec"), V("supply")],
  },
  {
    code: "FIN-ACCOUNTANT",
    title: "Accountant",
    department: "finance",
    discipline: "Finance",
    description: "Voucher entry, invoice booking, bank entries, reconciles.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("finance"), E("finance")],
  },
  {
    code: "FIN-PAYROLL",
    title: "Payroll Officer",
    department: "finance",
    discipline: "Payroll",
    description: "Payslips, statutory PF/ESI/PT, challans, run approvals.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("finance"), V("people"), E("people")],
  },
  {
    code: "FIN-TREASURY",
    title: "Treasury Officer",
    department: "finance",
    discipline: "Treasury",
    description: "Inflow/outflow, bank recon, challan posting, repair queue.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("finance"), E("finance")],
  },
  {
    code: "FIN-COSTING",
    title: "Costing Analyst",
    department: "finance",
    discipline: "Costing",
    description: "Job costing, CoQ, standard vs actual, budget burn.",
    perms: [V("finance"), V("ops")],
  },

  // ==== PEOPLE ====
  {
    code: "PEOPLE-HEAD",
    title: "HR Head",
    department: "people",
    discipline: "Human Resources",
    description: "Policy, compliance, grievances, disciplinary, training, risk.",
    perms: [V("people"), E("people"), A("people"), V("finance"), V("exec")],
  },
  {
    code: "PEOPLE-HR-EXEC",
    title: "HR Executive",
    department: "people",
    discipline: "Human Resources",
    description: "Recruitment, onboarding, attendance, leaves, appraisals admin.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("people"), E("people")],
  },
  {
    code: "PEOPLE-TRAINER",
    title: "Training Coordinator",
    department: "people",
    discipline: "Learning & Development",
    description: "Programs, attendance, effectiveness scores, compliance training.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("people"), E("people")],
  },
  {
    code: "PEOPLE-TIME",
    title: "Time-Office Clerk",
    department: "people",
    discipline: "Time Office",
    description: "Attendance flags, OT register, shift rosters, disputes.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("people"), E("people"), V("ops")],
  },

  // ==== EHS ====
  {
    code: "EHS-HEAD",
    title: "EHS Head",
    department: "ehs",
    discipline: "EHS",
    description: "Consents, permits, incidents, near-miss quota, safety metrics.",
    perms: [V("ehs"), E("ehs"), A("ehs"), V("maintenance")],
  },
  {
    code: "EHS-OFFICER",
    title: "EHS Officer",
    department: "ehs",
    discipline: "EHS",
    description: "Inspections, observations, permits, extinguisher inspections.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("ehs"), E("ehs")],
  },

  // ==== ENGINEERING ====
  {
    code: "ENG-HEAD",
    title: "Engineering Head",
    department: "engineering",
    discipline: "Engineering",
    description: "Drawing control, ECO/ECN, R&D campaigns, fixture strategy.",
    perms: [V("engineering"), E("engineering"), A("engineering"), V("quality")],
  },
  {
    code: "ENG-DESIGN",
    title: "Design Engineer",
    department: "engineering",
    discipline: "Design",
    description: "Drawing changes, ECO authorship, product design, prototypes.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("engineering"), E("engineering"), V("projects")],
  },
  {
    code: "ENG-METHODS",
    title: "Methods Engineer",
    department: "engineering",
    discipline: "Manufacturing Engineering",
    description: "Routing, process sheets, fixture design, estimates.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("engineering"), E("engineering"), V("ops")],
  },
  {
    code: "ENG-FIXTURE",
    title: "Fixture Engineer",
    department: "engineering",
    discipline: "Tooling",
    description: "Fixture design, validation, fixture register upkeep.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("engineering"), E("engineering"), V("maintenance")],
  },
  {
    code: "ENG-RND",
    title: "R&D Engineer",
    department: "engineering",
    discipline: "Research & Development",
    description: "Test campaigns, prototypes, technology trials.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("engineering"), E("engineering"), V("quality")],
  },

  // ==== METROLOGY ====
  {
    code: "MET-HEAD",
    title: "Metrology Head",
    department: "metrology",
    discipline: "Metrology",
    description: "Calibration programme, gage R&R governance, instrument control.",
    perms: [V("metrology"), E("metrology"), A("metrology"), V("quality")],
  },
  {
    code: "MET-CALIB",
    title: "Calibration Technician",
    department: "metrology",
    discipline: "Calibration",
    description: "Due schedules, calibration records, quarantine actions.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("metrology"), E("metrology")],
  },
  {
    code: "MET-GAGE",
    title: "Gage & Instrument Keeper",
    department: "metrology",
    discipline: "Instrument Control",
    description: "Instrument issue, tool crib, quarantine of suspect gages.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("metrology"), E("metrology")],
  },

  // ==== IT ====
  {
    code: "IT-ADMIN",
    title: "IT / System Admin",
    department: "system",
    discipline: "IT",
    description: "Users, roles, sessions, backups, updates, devices, security.",
    perms: ["system.view", "system.edit", "system.approve", "users.manage", "audit.view", "records.edit", "kpi.override"],
  },
  {
    code: "IT-SUPPORT",
    title: "IT Support",
    department: "system",
    discipline: "IT",
    description: "Tickets, SLAs, device help.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("system"), "users.manage"],
  },

  // ==== PROJECTS ====
  {
    code: "PROJ-MGR",
    title: "Project Manager",
    department: "projects",
    discipline: "Program Management",
    description: "Milestones, program health, contracts, escalations to exec.",
    grades: ["JUNIOR", "SENIOR", "LEAD"],
    perms: [V("projects"), E("projects"), A("projects"), V("engineering")],
  },

  // ==== LEGAL ====
  {
    code: "LEGAL-COUNSEL",
    title: "Legal Counsel / Compliance Officer",
    department: "legal",
    discipline: "Legal",
    description: "Contracts, litigation, statutory registers, RPT, whistleblower.",
    grades: ["JUNIOR", "SENIOR", "LEAD"],
    perms: [V("legal"), E("legal"), V("finance"), V("people"), "audit.view"],
  },

  // ==== RISK ====
  {
    code: "RISK-CHAMPION",
    title: "Risk Champion",
    department: "risk",
    discipline: "Governance",
    description: "Risk register upkeep, review cadence, mitigation, MRM risk agenda.",
    perms: [V("risk"), E("risk"), V("exec"), V("quality"), V("ehs")],
  },

  // ==== SUSTAINABILITY ====
  {
    code: "SUST-OFFICER",
    title: "Sustainability Officer",
    department: "sustainability",
    discipline: "Sustainability",
    description: "Energy, utilities, environmental records, haz-waste.",
    grades: ["JUNIOR", "SENIOR"],
    perms: [V("sustainability"), E("sustainability"), V("ehs")],
  },

  // ==== BRAND ====
  {
    code: "BRAND-OWNER",
    title: "Brand Owner",
    department: "brand",
    discipline: "Brand",
    description: "Branding settings, marketing collateral, brand consistency.",
    perms: [V("brand"), E("brand"), V("commercial")],
  },
];

// ---- helpers exported for the page + tests ------------------------------
export function allDomainViews(): string[] {
  return ["ops", "supply", "commercial", "people", "system", "quality", "metrology", "engineering", "finance", "ehs", "maintenance", "projects", "exec", "legal", "risk", "brand", "sustainability"].map(V);
}

function allDomainApproves(): string[] {
  return ["ops", "supply", "commercial", "people", "system", "quality", "metrology", "engineering", "finance", "ehs", "maintenance", "projects", "exec"].map(A);
}

/** Department display name for a domain key (mirrors departments.ts labels). */
export function departmentLabel(key: string): string {
  const map: Record<string, string> = {
    ops: "Operations",
    supply: "Supply Chain",
    commercial: "Commercial",
    people: "People",
    system: "IT & System",
    quality: "Quality",
    metrology: "Metrology",
    engineering: "Engineering",
    finance: "Finance",
    ehs: "EHS",
    maintenance: "Maintenance",
    projects: "Projects",
    exec: "Executive",
    legal: "Legal",
    risk: "Risk",
    brand: "Brand",
    sustainability: "Sustainability",
  };
  return map[key] || key;
}

/** Roles grouped by department, in stable department order. */
export function catalogByDepartment(): Array<{ department: string; label: string; roles: CatalogRole[] }> {
  const order = ["exec", "ops", "quality", "supply", "maintenance", "commercial", "finance", "people", "ehs", "engineering", "metrology", "system", "projects", "legal", "risk", "sustainability"];
  const groups = new Map<string, CatalogRole[]>();
  for (const r of ROLE_CATALOG) {
    if (!groups.has(r.department)) groups.set(r.department, []);
    groups.get(r.department)!.push(r);
  }
  const keys = [...groups.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return keys.map((k) => ({ department: k, label: departmentLabel(k), roles: groups.get(k)! }));
}