import { prisma } from './src/lib/prisma';
import { addDays, startOfDay } from 'date-fns';

async function main() {
  const p1 = await prisma.product.findFirst({ where: { sku: "PRD-AL-HOUSING" } });
  if (!p1) return console.log("Product not found");

  const today = startOfDay(new Date());

  await prisma.workOrder.create({
    data: {
      woNumber: "WO-HEAVY-001",
      productId: p1.id,
      plannedQuantity: 150000,
      status: "PLANNED",
      plannedStartDate: today,
      plannedEndDate: addDays(today, 2),
      currentSeq: 1,
    }
  });
  console.log("Heavy WO created");
}

main().catch(console.error).finally(() => prisma.$disconnect());
