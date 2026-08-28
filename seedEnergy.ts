import { prisma } from './src/lib/prisma';
import { subDays, startOfDay } from 'date-fns';

async function main() {
  console.log("Seeding 14 days of EnergyReadings...");
  const today = startOfDay(new Date());
  
  const readings = [];
  for (let i = 14; i >= 0; i--) {
    const d = subDays(today, i);
    // Base load + variation
    const kwh = 1500 + Math.random() * 500;
    const unitCost = 8.00; // default
    readings.push({
      date: d,
      totalKwh: kwh,
      unitCostPerKwh: unitCost,
      totalCost: kwh * unitCost,
    });
  }

  for (const r of readings) {
    await prisma.energyReading.upsert({
      where: { date: r.date },
      update: {},
      create: r,
    });
  }
  
  console.log("EnergyReadings seeded.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
