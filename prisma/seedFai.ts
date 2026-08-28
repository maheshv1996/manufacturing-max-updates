import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding FAI reports and QC Parameters...");

  // Get the Aerospace WO seeded by seedSerial
  const wo = await prisma.workOrder.findFirst({
    where: { trackingMode: 'SERIAL', status: 'IN_PROGRESS' },
    include: { product: true }
  });

  if (!wo) {
    console.error("Missing Serial Work Order. Run seedSerial first.");
    return;
  }

  // Set faiRequired to true
  await prisma.workOrder.update({
    where: { id: wo.id },
    data: { faiRequired: true }
  });

  // Create QC Parameters for the product
  const qcParams = [];
  for (let i = 1; i <= 8; i++) {
    const charNo = `C${i.toString().padStart(2, '0')}`;
    qcParams.push(
      await prisma.qCParameter.create({
        data: {
          productId: wo.productId,
          charNo,
          description: `Characteristic ${i} description`,
          target: 10.0 + i,
          lsl: 9.0 + i,
          usl: 11.0 + i,
          method: "Caliper",
        }
      })
    );
  }
  console.log(`Created 8 QC Parameters for product ${wo.product.sku}`);

  // Create an APPROVED FAI report
  const approvedFai = await prisma.faiReport.create({
    data: {
      faiNumber: `FAI-${new Date().getFullYear()}-001`,
      workOrderId: wo.id,
      productId: wo.productId,
      drawingRevision: "Rev A",
      customerName: wo.customerName || "Aerospace Corp",
      type: "FULL",
      status: "APPROVED",
      preparedBy: "System",
      approvedBy: "QA Manager",
      approvedAt: new Date(),
      notes: "First article approved successfully.",
    }
  });

  // Add passed characteristics to the APPROVED report
  for (const param of qcParams) {
    await prisma.faiCharacteristic.create({
      data: {
        faiReportId: approvedFai.id,
        charNo: param.charNo,
        description: param.description,
        target: param.target,
        lsl: param.lsl,
        usl: param.usl,
        actual: param.target,
        method: param.method,
        status: "PASS",
      }
    });
  }

  // Create an IN_PROGRESS FAI report
  await prisma.faiReport.create({
    data: {
      faiNumber: `FAI-${new Date().getFullYear()}-002`,
      workOrderId: wo.id,
      productId: wo.productId,
      drawingRevision: "Rev A",
      customerName: wo.customerName || "Aerospace Corp",
      type: "FULL",
      status: "IN_PROGRESS",
      preparedBy: "System",
    }
  });

  // We won't add characteristics to the IN_PROGRESS report yet, so we can test the "Import" functionality.
  
  console.log("Seeded FAI Reports.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
