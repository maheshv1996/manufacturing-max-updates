-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('KAIZEN', 'DMAIC');

-- CreateEnum
CREATE TYPE "ProjectPhase" AS ENUM ('DEFINE', 'MEASURE', 'ANALYZE', 'IMPROVE', 'CONTROL');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "FishboneCategory" AS ENUM ('MAN', 'MACHINE', 'METHOD', 'MATERIAL', 'MEASUREMENT', 'ENVIRONMENT');

-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('OPEN', 'DONE');

-- CreateTable
CREATE TABLE "ImprovementProject" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProjectType" NOT NULL,
    "phase" "ProjectPhase" NOT NULL DEFAULT 'DEFINE',
    "status" "ProjectStatus" NOT NULL DEFAULT 'OPEN',
    "ownerName" TEXT NOT NULL,
    "machineId" TEXT,
    "expectedAnnualSavings" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImprovementProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RcaRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "problemStatement" TEXT,
    "why1" TEXT,
    "why2" TEXT,
    "why3" TEXT,
    "why4" TEXT,
    "why5" TEXT,
    "rootCause" TEXT,
    "fishboneCategory" "FishboneCategory",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RcaRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ActionItemStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImprovementProject_status_idx" ON "ImprovementProject"("status");

-- CreateIndex
CREATE INDEX "ImprovementProject_type_idx" ON "ImprovementProject"("type");

-- CreateIndex
CREATE INDEX "ImprovementProject_machineId_idx" ON "ImprovementProject"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "RcaRecord_projectId_key" ON "RcaRecord"("projectId");

-- CreateIndex
CREATE INDEX "ActionItem_projectId_idx" ON "ActionItem"("projectId");

-- AddForeignKey
ALTER TABLE "ImprovementProject" ADD CONSTRAINT "ImprovementProject_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RcaRecord" ADD CONSTRAINT "RcaRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ImprovementProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ImprovementProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
