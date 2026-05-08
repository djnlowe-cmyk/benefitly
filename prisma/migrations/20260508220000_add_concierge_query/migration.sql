-- CreateTable
CREATE TABLE "ConciergeQuery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "expectedAnswer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConciergeQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConciergeQuery_userId_idx" ON "ConciergeQuery"("userId");

-- CreateIndex
CREATE INDEX "ConciergeQuery_status_idx" ON "ConciergeQuery"("status");

-- AddForeignKey
ALTER TABLE "ConciergeQuery" ADD CONSTRAINT "ConciergeQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
