-- Drafts may be persisted before submission-required fields are complete.
ALTER TABLE "ChangeRequest" ALTER COLUMN "title" SET DEFAULT '';
ALTER TABLE "ChangeRequest" ALTER COLUMN "description" SET DEFAULT '';
ALTER TABLE "ChangeRequest" ALTER COLUMN "machineTypeId" DROP NOT NULL;

CREATE TABLE "ChangeRequestCounter" (
    "year" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChangeRequestCounter_pkey" PRIMARY KEY ("year")
);
