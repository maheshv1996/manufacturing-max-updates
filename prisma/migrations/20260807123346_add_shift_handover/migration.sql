-- CreateTable
CREATE TABLE "ShiftHandover" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shiftId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "machineId" TEXT,
    "productionNotes" TEXT NOT NULL,
    "downtimeNotes" TEXT NOT NULL,
    "safetyNotes" TEXT NOT NULL,
    "nextShiftActions" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftHandover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftHandover_shiftId_idx" ON "ShiftHandover"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftHandover_machineId_idx" ON "ShiftHandover"("machineId");

-- CreateIndex
CREATE INDEX "ShiftHandover_date_idx" ON "ShiftHandover"("date");

-- AddForeignKey
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
