-- CreateTable
CREATE TABLE "CoverageGapDismissal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coverageId" TEXT NOT NULL,
    "gapKey" TEXT NOT NULL,
    "dismissReason" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverageGapDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoverageGapDismissal_userId_coverageId_idx" ON "CoverageGapDismissal"("userId", "coverageId");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageGapDismissal_userId_coverageId_gapKey_key" ON "CoverageGapDismissal"("userId", "coverageId", "gapKey");

-- AddForeignKey
ALTER TABLE "CoverageGapDismissal" ADD CONSTRAINT "CoverageGapDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageGapDismissal" ADD CONSTRAINT "CoverageGapDismissal_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "Coverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
