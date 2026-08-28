import { prisma } from "./src/lib/prisma";
async function main() {
  const rs = await prisma.downtimeReason.findMany();
  console.log(JSON.stringify(rs, null, 2));
}
main();
