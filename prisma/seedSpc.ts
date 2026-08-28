import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log('Seeding SPC Data...')

  // Find a machine
  const machine = await prisma.machine.findFirst()
  if (!machine) {
    console.log('No machine found to seed SPC data.')
    return
  }

  const chars = ['Length (mm)', 'Weight (g)']
  
  for (const characteristic of chars) {
    // Generate 30 measurements for the last 30 hours
    const measurements = []
    let target = characteristic === 'Length (mm)' ? 100 : 50
    let variance = characteristic === 'Length (mm)' ? 2 : 1
    
    for (let i = 0; i < 30; i++) {
      const date = new Date()
      date.setHours(date.getHours() - (30 - i))
      
      const val = target + (Math.random() * variance * 2 - variance)
      measurements.push({
        machineId: machine.id,
        characteristic,
        value: Number(val.toFixed(2)),
        lsl: target - variance * 1.5,
        usl: target + variance * 1.5,
        target: target,
        measuredAt: date
      })
    }
    
    await prisma.qualityMeasurement.createMany({
      data: measurements
    })
    console.log(`Seeded 30 measurements for ${characteristic} on ${machine.name}`)
  }

  console.log('Done seeding SPC data.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
