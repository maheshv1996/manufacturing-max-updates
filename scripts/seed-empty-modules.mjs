// Seed demo rows for module tables that are empty in the real cluster:
// Eco, FAI, Kaizen (ImprovementProject), R&D (TestCampaign), Permits,
// Vouchers, Grievances, Disciplinary, GstRecon, RateContracts.
// Idempotent: skips anything already present. Run with DATABASE_URL set.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
const now = new Date();
const seeded = [];

// ── lookups ────────────────────────────────────────────────────────────────
const wo = await prisma.workOrder.findFirst({ where: { status: "IN_PROGRESS" } });
const completedWo = await prisma.workOrder.findFirst({ where: { status: "COMPLETED" } });
const product = wo ? await prisma.product.findUnique({ where: { id: wo.productId } }) : null;
const machine = await prisma.machine.findFirst();
const rm = await prisma.rawMaterial.findFirst();
const supplier = await prisma.supplier.findFirst();
const maintJob = await prisma.maintenanceJob.findFirst({ where: { status: { not: "CLOSED" } } });
const admins = await prisma.user.findMany({ where: { isOwner: true }, take: 2 });
const operators = await prisma.user.findMany({ where: { level: "WORKER" }, take: 2 });
const anyUsers = await prisma.user.findMany({ take: 3 });

// ── ECO / ECN ──────────────────────────────────────────────────────────────
if (product) {
  const eco = await prisma.eco.findUnique({ where: { ecoNumber: "ECO-2026-101" } });
  if (!eco) {
    const created = await prisma.eco.create({
      data: {
        ecoNumber: "ECO-2026-101",
        title: "Update BOM — alternate aluminum grade for housing",
        description: "Permit AL6061-T6 as acceptable alternate to AL7075 on PRD-AL-HOUSING drawing B.",
        status: "APPROVED",
        effectivityType: "DATE",
        effectivityValue: "2026-09-01",
        raisedBy: (admins[0]?.name) || "Engineering",
        approvedBy: (admins[0]?.name) || "Engineering Manager",
        approvedAt: new Date(now.getTime() - 5 * 86400000),
        implementedAt: new Date(now.getTime() - 2 * 86400000),
        items: {
          create: [
            {
              entityType: "BOM",
              productId: product.id,
              action: "REPLACE",
              notes: "Alternate raw material grade",
              oldData: { material: "AL7075" },
              newData: { material: "AL6061-T6" },
            },
          ],
        },
      },
    });
    seeded.push(`ECO-2026-101 (${created.id})`);
  } else seeded.push("ECO-2026-101 (exists)");
} else {
  console.log("skip Eco — no product found");
}

// ── FAI ────────────────────────────────────────────────────────────────────
if (wo && product) {
  const fai = await prisma.faiReport.findUnique({ where: { faiNumber: "FAI-2026-001" } });
  if (!fai) {
    const created = await prisma.faiReport.create({
      data: {
        faiNumber: "FAI-2026-001",
        workOrderId: wo.id,
        productId: product.id,
        drawingRevision: "Rev B",
        customerName: wo.customerName || null,
        type: "FULL",
        status: "SUBMITTED",
        preparedBy: (anyUsers[0]?.name) || "Quality",
        notes: "First article per AS9102 — dimensional + material cert review pending approval.",
        characteristics: {
          create: [
            { charNo: "1", description: "Bore diameter Ø40.00 ±0.05", target: 40, lsl: 39.95, usl: 40.05, actual: 40.01, method: "CMM", status: "PASS" },
            { charNo: "2", description: "Surface finish Ra 1.6 max", target: 1.6, lsl: null, usl: 1.6, actual: 1.2, method: "Profilometer", status: "PASS" },
            { charNo: "3", description: "Hardness 90–100 HRB", target: 95, lsl: 90, usl: 100, actual: 96, method: "Hardness tester", status: "PASS" },
          ],
        },
      },
    });
    seeded.push(`FAI-2026-001 (${created.id})`);
  } else seeded.push("FAI-2026-001 (exists)");
} else {
  console.log("skip FAI — no active WO/product");
}

// ── Kaizen / ImprovementProject ────────────────────────────────────────────
const kz = await prisma.improvementProject.findFirst({ where: { title: "Kaizen — tool change jig for CNC spindle" } });
if (!kz) {
  const created = await prisma.improvementProject.create({
    data: {
      title: "Kaizen — tool change jig for CNC spindle",
      description: "Ergonomic tool-change jig reduces spindle changeover by 12 minutes per setup.",
      type: "KAIZEN",
      phase: "IMPROVE",
      status: "IN_PROGRESS",
      ownerName: (operators[0]?.name) || "Mike Ross",
      machineId: machine?.id || null,
      expectedAnnualSavings: 124000,
    },
  });
  seeded.push(`Kaizen: tool change jig (${created.id})`);
} else seeded.push("Kaizen (exists)");

// ── R&D / TestCampaign ─────────────────────────────────────────────────────
if (wo) {
  const tc = await prisma.testCampaign.findUnique({ where: { campaignNumber: "RND-2026-001" } });
  if (!tc) {
    const created = await prisma.testCampaign.create({
      data: {
        campaignNumber: "RND-2026-001",
        workOrderId: wo.id,
        title: "Prototype validation — thermal cycle endurance",
        status: "RUNNING",
        testCostRupees: 45000,
        notes: "Validation campaign for aerospace-grade housing prototype.",
        records: {
          create: [
            { parameterName: "Thermal cycle -40..+85°C", unit: "cycles", target: 100, actual: 100, result: "PASS", testedBy: (anyUsers[0]?.name) || "R&D Lab" },
            { parameterName: "Vibration 10-2000Hz", unit: "h", target: 8, actual: 8, result: "PASS", testedBy: (anyUsers[0]?.name) || "R&D Lab" },
            { parameterName: "Salt spray", unit: "h", target: 48, actual: 42, result: "FAIL", testedBy: (anyUsers[0]?.name) || "R&D Lab" },
          ],
        },
      },
    });
    seeded.push(`RND-2026-001 (${created.id})`);
  } else seeded.push("RND-2026-001 (exists)");
} else {
  console.log("skip R&D — no WO");
}

// ── Permits ────────────────────────────────────────────────────────────────
if (maintJob) {
  const pt = await prisma.permitToWork.findUnique({ where: { permitNo: "PTW-2026-001" } });
  if (!pt) {
    const created = await prisma.permitToWork.create({
      data: {
        permitNo: "PTW-2026-001",
        maintenanceJobId: maintJob.id,
        type: "HOT_WORK",
        description: "Welding repair on CNC bay coolant line flange",
        location: (await prisma.machine.findFirst({ where: { id: maintJob.machineId } }))?.stationName || "CNC Bay",
        requestedBy: (operators[0]?.name) || "Mike Ross",
        status: "APPROVED",
        ehsApprovedBy: (admins[0]?.name) || "EHS",
        ehsApprovedAt: new Date(now.getTime() - 2 * 86400000),
        ehsApprovedReason: "Gas detector check passed; fire watch assigned.",
        maintApprovedBy: (admins[0]?.name) || "Maintenance",
        maintApprovedAt: new Date(now.getTime() - 2 * 86400000 + 3600000),
        maintApprovedReason: "Job critical to production; crew competent.",
        prodApprovedBy: (admins[0]?.name) || "Production",
        prodApprovedAt: new Date(now.getTime() - 2 * 86400000 + 2 * 3600000),
        prodApprovedReason: "Approved — scheduled shutdown window.",
        validFrom: new Date(now.getTime() - 1 * 86400000),
        validUntil: new Date(now.getTime() + 1 * 86400000),
      },
    });
    seeded.push(`PTW-2026-001 (${created.id})`);
  } else seeded.push("PTW-2026-001 (exists)");
} else {
  console.log("skip Permit — no open maintenance job");
}

// ── Vouchers ───────────────────────────────────────────────────────────────
for (const v of [
  { voucherNumber: "VCH-2026-0001", voucherType: "PAYMENT", amount: 145000, account: "Supplier Payables", particulars: "PO-2026-014 — steel plates (recvd) payment", status: "PENDING_CHECK" },
  { voucherNumber: "VCH-2026-0002", voucherType: "RECEIPT", amount: 225000, account: "Customer Receivables", particulars: "INV-2026-7788 partial receipt", status: "POSTED", checkedBy: (admins[0]?.name) || "Finance" },
]) {
  const ex = await prisma.voucher.findUnique({ where: { voucherNumber: v.voucherNumber } });
  if (!ex) {
    const created = await prisma.voucher.create({ data: { ...v, enteredBy: (admins[0]?.name) || "Accounts" } });
    seeded.push(`${v.voucherNumber} (${created.id})`);
  } else seeded.push(`${v.voucherNumber} (exists)`);
}

// ── Grievances ─────────────────────────────────────────────────────────────
if (operators[0]) {
  const g = await prisma.grievance.findUnique({ where: { grievanceNumber: "GRV-2026-001" } });
  if (!g) {
    const created = await prisma.grievance.create({
      data: {
        grievanceNumber: "GRV-2026-001",
        userId: operators[0].id,
        category: "FACILITIES",
        description: "Break room water cooler out of service for 3 days.",
        stage: "INVESTIGATING",
        acknowledgedAt: new Date(now.getTime() - 2 * 86400000),
        acknowledgedBy: (admins[0]?.name) || "HR",
        investigatedAt: new Date(now.getTime() - 1 * 86400000),
        investigatedBy: (admins[0]?.name) || "HR",
      },
    });
    seeded.push(`GRV-2026-001 (${created.id})`);
  } else seeded.push("GRV-2026-001 (exists)");
} else {
  console.log("skip Grievance — no operator user");
}

// ── Disciplinary ───────────────────────────────────────────────────────────
if (operators[1] || operators[0]) {
  const u = operators[1] || operators[0];
  const d = await prisma.disciplinaryCase.findUnique({ where: { caseNumber: "DISC-2026-001" } });
  if (!d) {
    const created = await prisma.disciplinaryCase.create({
      data: {
        caseNumber: "DISC-2026-001",
        userId: u.id,
        category: "CONDUCT",
        description: "Repeated late clock-ins documented by time office.",
        stage: "HEARING",
        noticeIssuedAt: new Date(now.getTime() - 10 * 86400000),
        hearingDate: new Date(now.getTime() + 3 * 86400000),
      },
    });
    seeded.push(`DISC-2026-001 (${created.id})`);
  } else seeded.push("DISC-2026-001 (exists)");
}

// ── GstRecon ───────────────────────────────────────────────────────────────
const gst = await prisma.gstReconRun.findFirst({ where: { period: "2026-07" } });
if (!gst) {
  const created = await prisma.gstReconRun.create({
    data: {
      period: "2026-07",
      label: "GSTR-2B Jul 2026 — initial upload",
      rows: [
        { gstin: "27AAACA12341Z1", supplierName: "Steel Suppliers Pvt Ltd", invoiceNumber: "SSPL-8821", invoiceDate: "2026-07-12", taxable: 120000, tax: 21600, total: 141600, status: "MATCHED", diff: 0 },
        { gstin: "27AAACA12341Z1", supplierName: "Electro Components Co", invoiceNumber: "ECC-4410", invoiceDate: "2026-07-19", taxable: 45000, tax: 8100, total: 53100, status: "AMOUNT_DIFF", diff: 120 },
      ],
      stats: { matched: 1, amountDiff: 1, notInRegister: 0, missingFromCsv: 0, total: 2, registerTotal: 194700 },
      followUps: [{ at: now.toISOString(), by: (admins[0]?.name) || "Accounts", note: "Chasing invoice ECC-4410 value difference" }],
      status: "OPEN",
      uploadedBy: (admins[0]?.name) || "Accounts",
    },
  });
  seeded.push(`GstRecon 2026-07 (${created.id})`);
} else seeded.push("GstRecon 2026-07 (exists)");

// ── RateContracts ──────────────────────────────────────────────────────────
if (rm && supplier) {
  const rc = await prisma.rateContract.findUnique({ where: { contractNumber: "RC-2026-001" } });
  if (!rc) {
    const created = await prisma.rateContract.create({
      data: {
        contractNumber: "RC-2026-001",
        rawMaterialId: rm.id,
        supplierId: supplier.id,
        rate: 385,
        validFrom: new Date(2026, 3, 1),
        validTo: new Date(2027, 2, 31),
        status: "ACTIVE",
        notes: "Annual rate contract — steel grade, reviewed quarterly.",
        createdBy: (admins[0]?.name) || "Procurement",
      },
    });
    seeded.push(`RC-2026-001 (${created.id})`);
  } else seeded.push("RC-2026-001 (exists)");
} else {
  console.log("skip RateContract — no raw material/supplier");
}

console.log("seeded:", seeded.length ? seeded.join(", ") : "(none)");
await prisma.$disconnect();
