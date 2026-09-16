ALTER TABLE "ChangeRequest"
ADD COLUMN "aiCompletionSummary" TEXT,
ADD COLUMN "aiSummaryGeneratedAt" TIMESTAMP(3),
ADD COLUMN "aiSummaryError" TEXT;
