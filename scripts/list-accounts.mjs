import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const accounts = await p.glAccount.findMany({ select: { id: true, code: true } });
console.log(accounts.map(a => `${a.id}|${a.code}`).join("\n"));
await p.$disconnect();
