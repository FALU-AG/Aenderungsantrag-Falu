ALTER TABLE "ChangeRequest"
ADD COLUMN "finalReviewCycle" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "finalComment" TEXT;

CREATE TABLE "FinalApproval" (
  "id" TEXT NOT NULL,
  "changeRequestId" TEXT NOT NULL,
  "cycle" INTEGER NOT NULL,
  "type" "ApprovalType" NOT NULL,
  "approvedById" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinalApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinalApproval_changeRequestId_cycle_type_key" ON "FinalApproval"("changeRequestId", "cycle", "type");
CREATE INDEX "FinalApproval_changeRequestId_cycle_idx" ON "FinalApproval"("changeRequestId", "cycle");
ALTER TABLE "FinalApproval" ADD CONSTRAINT "FinalApproval_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinalApproval" ADD CONSTRAINT "FinalApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
