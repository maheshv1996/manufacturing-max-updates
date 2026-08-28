import { prisma } from "./src/lib/prisma";
async function main() {
  const p = await prisma.plant.findFirst();
  console.log("PLANT_ID:", p?.id);
}
main();
