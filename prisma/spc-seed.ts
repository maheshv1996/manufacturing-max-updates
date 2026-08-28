// SPC seed: 120 measurements for Bore Diameter (mm) on CNC-01
import { prisma } from "../src/lib/prisma";

const TARGET = 25.0;
const LSL = 24.95;
const USL = 25.05;
const SIGMA = 0.012; // natural process std dev — gives Cpk ~1.0-1.2

function normalRandom(mean: number, std: number): number {
  // Box-Muller transform
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const n = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return +(mean + std * n).toFixed(4);
}

async function main() {
  console.log("Seeding SPC measurements...");

  const cnc = await prisma.machine.findFirst({ where: { code: "CNC-01" } });
  if (!cnc) throw new Error("CNC-01 not found — run main seed first");

  // Clear old measurements for this machine/characteristic
  await prisma.qualityMeasurement.deleteMany({
    where: { machineId: cnc.id, characteristic: "Bore Diameter (mm)" },
  });

  const now = new Date();
  const measurements: {
    machineId: string;
    characteristic: string;
    value: number;
    lsl: number;
    usl: number;
    target: number;
    measuredAt: Date;
  }[] = [];

  // 120 measurements spread over 30 days, 4 per day (groups of 5 = 24 subgroups)
  const DAYS = 30;
  const PER_DAY = 4;

  for (let day = DAYS - 1; day >= 0; day--) {
    for (let j = 0; j < PER_DAY; j++) {
      const measuredAt = new Date(now);
      measuredAt.setDate(measuredAt.getDate() - day);
      measuredAt.setHours(6 + j * 4 + Math.floor(Math.random() * 2));
      measuredAt.setMinutes(Math.floor(Math.random() * 60));

      let value = normalRandom(TARGET, SIGMA);

      // Simulate a small process shift in the middle (days 10-14)
      if (day >= 10 && day <= 14) {
        value = normalRandom(TARGET + 0.015, SIGMA);
      }

      measurements.push({
        machineId: cnc.id,
        characteristic: "Bore Diameter (mm)",
        value,
        lsl: LSL,
        usl: USL,
        target: TARGET,
        measuredAt,
      });
    }
  }

  // Add 3 obvious outliers
  const outlierDays = [5, 18, 27];
  for (const day of outlierDays) {
    const measuredAt = new Date(now);
    measuredAt.setDate(measuredAt.getDate() - day);
    measuredAt.setHours(14);
    const direction = Math.random() > 0.5 ? 1 : -1;
    measurements.push({
      machineId: cnc.id,
      characteristic: "Bore Diameter (mm)",
      value: +(TARGET + direction * (SIGMA * 4.5)).toFixed(4),
      lsl: LSL,
      usl: USL,
      target: TARGET,
      measuredAt,
    });
  }

  // Sort by time
  measurements.sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());

  await prisma.qualityMeasurement.createMany({ data: measurements });
  console.log(`Seeded ${measurements.length} SPC measurements for CNC-01.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
