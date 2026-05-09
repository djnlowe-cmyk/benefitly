-- CreateTable
CREATE TABLE "CoverageDetailView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coverageId" TEXT NOT NULL,
    "firedGapCount" INTEGER NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverageDetailView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoverageDetailView_userId_idx" ON "CoverageDetailView"("userId");

-- CreateIndex
CREATE INDEX "CoverageDetailView_coverageId_idx" ON "CoverageDetailView"("coverageId");

-- CreateIndex
CREATE INDEX "CoverageDetailView_viewedAt_idx" ON "CoverageDetailView"("viewedAt");

-- AddForeignKey
ALTER TABLE "CoverageDetailView" ADD CONSTRAINT "CoverageDetailView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageDetailView" ADD CONSTRAINT "CoverageDetailView_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "Coverage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
