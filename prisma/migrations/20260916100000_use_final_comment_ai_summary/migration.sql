UPDATE "ChangeRequest"
SET "finalComment" = COALESCE("finalComment", "aiCompletionSummary")
WHERE "aiCompletionSummary" IS NOT NULL;

ALTER TABLE "ChangeRequest"
DROP COLUMN "aiCompletionSummary",
DROP COLUMN "aiSummaryGeneratedAt",
DROP COLUMN "aiSummaryError";
