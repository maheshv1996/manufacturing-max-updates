-- CreateTable
CREATE TABLE "QualityMeasurement" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "characteristic" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "lsl" DOUBLE PRECISION NOT NULL,
    "usl" DOUBLE PRECISION NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QualityMeasurement_machineId_idx" ON "QualityMeasurement"("machineId");

-- CreateIndex
CREATE INDEX "QualityMeasurement_characteristic_idx" ON "QualityMeasurement"("characteristic");

-- CreateIndex
CREATE INDEX "QualityMeasurement_measuredAt_idx" ON "QualityMeasurement"("measuredAt");

-- AddForeignKey
ALTER TABLE "QualityMeasurement" ADD CONSTRAINT "QualityMeasurement_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
