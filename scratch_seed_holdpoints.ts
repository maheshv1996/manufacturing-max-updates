import { config } from "dotenv";
config();
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding hold points...");

  const wos = await prisma.workOrder.findMany({
    include: { product: { include: { routingSteps: true } } },
    take: 2,
  });

  if (wos.length < 2) return;

  // 1. Setup a hold point on a step for WO 1 and add a signoff (Already signed)
  const wo1 = wos[0];
  const step1 = wo1.product.routingSteps[0];
  
  await prisma.routingStep.update({
    where: { id: step1.id },
    data: { isHoldPoint: true, holdAuthority: "DSA" },
  });

  try {
    await prisma.holdPointSignoff.create({
      data: {
        workOrderId: wo1.id,
        routingStepId: step1.id,
        inspectorName: "John Doe",
        inspectorOrg: "DSA QA",
        result: "PASSED",
        remarks: "Looks good",
        signedById: "system",
      },
    });
  } catch(e) {} // ignore unique/duplicate

  // 2. Setup a hold point for WO 2 but NO signoff (AWAITING SIGN-OFF)
  const wo2 = wos[1];
  const step2 = wo2.product.routingSteps[1] || wo2.product.routingSteps[0];
  
  await prisma.routingStep.update({
    where: { id: step2.id },
    data: { isHoldPoint: true, holdAuthority: "CEMILAC" },
  });

  console.log("Seeded hold points and signoffs.");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
