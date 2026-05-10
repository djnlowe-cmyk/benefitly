-- CreateTable
CREATE TABLE "ClaudeUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT,
    "task" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheCreationTokens" INTEGER NOT NULL DEFAULT 0,
    "costPence" INTEGER NOT NULL DEFAULT 0,
    "successful" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaudeUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClaudeUsage_userId_createdAt_idx" ON "ClaudeUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ClaudeUsage_documentId_idx" ON "ClaudeUsage"("documentId");

-- CreateIndex
CREATE INDEX "ClaudeUsage_task_createdAt_idx" ON "ClaudeUsage"("task", "createdAt");

-- AddForeignKey
ALTER TABLE "ClaudeUsage" ADD CONSTRAINT "ClaudeUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaudeUsage" ADD CONSTRAINT "ClaudeUsage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
