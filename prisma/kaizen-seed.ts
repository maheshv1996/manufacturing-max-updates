// Kaizen / DMAIC seed
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding Kaizen/DMAIC projects...");

  await prisma.actionItem.deleteMany({});
  await prisma.rcaRecord.deleteMany({});
  await prisma.improvementProject.deleteMany({});

  const cnc = await prisma.machine.findFirst({ where: { code: "CNC-01" } });
  const imm = await prisma.machine.findFirst({ where: { code: "IMM-02" } });

  const now = new Date();
  const daysAgo = (n: number) => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };
  const daysAhead = (n: number) => { const d = new Date(now); d.setDate(d.getDate() + n); return d; };

  // 1. COMPLETED KAIZEN — Cycle Time Reduction
  const k1 = await prisma.improvementProject.create({
    data: {
      title: "CNC-01 Cycle Time Reduction — Tool Path Optimization",
      description: "Reduced non-cutting air-cut time on CNC-01 spindle by re-programming G-code tool paths using CAM simulation. Eliminated redundant rapid-traverse moves between bore passes.",
      type: "KAIZEN",
      phase: "CONTROL",
      status: "COMPLETED",
      ownerName: "Sarah Jenkins",
      machineId: cnc?.id,
      expectedAnnualSavings: 42000,
      createdAt: daysAgo(45),
      completedAt: daysAgo(5),
    },
  });
  await prisma.actionItem.createMany({
    data: [
      { projectId: k1.id, description: "Re-program G-code with optimized rapid paths", ownerName: "Mike Ross", dueDate: daysAgo(35), status: "DONE" },
      { projectId: k1.id, description: "Validate on 50-piece trial run, verify cycle time", ownerName: "Sarah Jenkins", dueDate: daysAgo(20), status: "DONE" },
      { projectId: k1.id, description: "Update standard work documentation and SOP", ownerName: "System Admin", dueDate: daysAgo(10), status: "DONE" },
    ],
  });

  // 2. DMAIC IN ANALYZE — Bore Diameter Defects
  const k2 = await prisma.improvementProject.create({
    data: {
      title: "DMAIC: Bore Diameter Out-of-Spec Reduction (CNC-01)",
      description: "Structured DMAIC to reduce Bore Diameter non-conformances on CNC-01 from 2.1% to below 0.5% defect rate. Cpk currently 0.98.",
      type: "DMAIC",
      phase: "ANALYZE",
      status: "IN_PROGRESS",
      ownerName: "Sarah Jenkins",
      machineId: cnc?.id,
      expectedAnnualSavings: 78000,
      createdAt: daysAgo(30),
    },
  });
  await prisma.rcaRecord.create({
    data: {
      projectId: k2.id,
      problemStatement: "Bore Diameter on CNC-01 measures outside LSL/USL (24.95–25.05 mm) at a rate of 2.1%, causing rework and scrap costs estimated at $78,000/year.",
      why1: "Bore diameters are frequently outside spec tolerances on CNC-01.",
      why2: "The boring tool exhibits excessive radial runout (>5 μm) after 500 cycles.",
      why3: "Tool holder collet shows wear patterns inconsistent with scheduled maintenance interval.",
      why4: "Collet inspection interval is set at 1,000 cycles, but tool wear accelerates on aluminum alloy grades above 6061-T6.",
      why5: "The maintenance PM schedule was written for mild steel and was never updated when material spec changed to aerospace-grade 7075-T6 aluminum.",
      rootCause: "Outdated PM schedule specifying collet inspection at 1,000-cycle intervals, not accounting for accelerated wear when machining 7075-T6 aluminum alloy.",
      fishboneCategory: "METHOD",
    },
  });
  await prisma.actionItem.createMany({
    data: [
      { projectId: k2.id, description: "Update PM schedule: collet inspection every 500 cycles for Al 7075-T6", ownerName: "Mike Ross", dueDate: daysAhead(7), status: "OPEN" },
      { projectId: k2.id, description: "Source and trial TiAlN-coated insert grade for better Al wear resistance", ownerName: "Sarah Jenkins", dueDate: daysAhead(14), status: "OPEN" },
      { projectId: k2.id, description: "Re-run capability study (n≥120) after maintenance change", ownerName: "Sarah Jenkins", dueDate: daysAhead(30), status: "OPEN" },
    ],
  });

  // 3. DMAIC IN DEFINE — Injection Molding Flash Defects
  await prisma.improvementProject.create({
    data: {
      title: "DMAIC: Flash Defect Elimination on IMM-02 Polymer Casings",
      description: "Injection molding flash on polymer casing part edges is causing 100% manual deburring, adding 12 seconds per part. Targeted Cpk improvement to ≥1.33 on wall thickness.",
      type: "DMAIC",
      phase: "DEFINE",
      status: "IN_PROGRESS",
      ownerName: "Alex Vance",
      machineId: imm?.id,
      expectedAnnualSavings: 31500,
      createdAt: daysAgo(8),
    },
  });

  // 4. ON_HOLD KAIZEN — Packaging Line Throughput
  await prisma.improvementProject.create({
    data: {
      title: "PKG-05 Throughput Improvement — Label Applicator Jams",
      description: "Label applicator on PKG-05 jams 3–5 times per shift, each requiring 2-3 minute reset. Kaizen event planned to address root mechanical cause. On hold pending supplier visit.",
      type: "KAIZEN",
      phase: "DEFINE",
      status: "ON_HOLD",
      ownerName: "John Doe",
      expectedAnnualSavings: 18000,
      createdAt: daysAgo(15),
    },
  });

  console.log("Kaizen seed complete! 4 projects created.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
