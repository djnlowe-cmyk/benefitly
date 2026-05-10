-- CreateTable
CREATE TABLE "DocumentAccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentAccessLog_documentId_grantedAt_idx" ON "DocumentAccessLog"("documentId", "grantedAt");

-- CreateIndex
CREATE INDEX "DocumentAccessLog_userId_grantedAt_idx" ON "DocumentAccessLog"("userId", "grantedAt");
