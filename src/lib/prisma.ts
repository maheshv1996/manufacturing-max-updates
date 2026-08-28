import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function getPool(): Pool {
  if (globalForPrisma.pool) {
    return globalForPrisma.pool;
  }
  let connectionString = process.env.DATABASE_URL || "";
  if (
    connectionString.includes("sslmode=require") &&
    !connectionString.includes("uselibpqcompat")
  ) {
    connectionString = connectionString.replace(
      "sslmode=require",
      "sslmode=verify-full",
    );
  }
  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pool = pool;
  }
  return pool;
}

function createPrismaClient() {
  const pool = getPool();
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
