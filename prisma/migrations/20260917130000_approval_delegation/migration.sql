CREATE TYPE "DelegationScope" AS ENUM ('AVOR_APPROVAL', 'TECHNICAL_APPROVAL');

CREATE TABLE "ApprovalDelegation" (
    "id" TEXT NOT NULL,
    "delegatingUserId" TEXT NOT NULL,
    "substituteUserId" TEXT NOT NULL,
    "scope" "DelegationScope" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApprovalDelegation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ApprovalDelegation_valid_period" CHECK ("endsAt" > "startsAt")
);

ALTER TABLE "Approval" ADD COLUMN "representedUserId" TEXT;
ALTER TABLE "Approval" ADD COLUMN "delegationId" TEXT;

CREATE INDEX "ApprovalDelegation_substituteUserId_scope_enabled_startsAt_endsAt_idx" ON "ApprovalDelegation"("substituteUserId", "scope", "enabled", "startsAt", "endsAt");
CREATE INDEX "ApprovalDelegation_delegatingUserId_scope_enabled_idx" ON "ApprovalDelegation"("delegatingUserId", "scope", "enabled");

ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_delegatingUserId_fkey" FOREIGN KEY ("delegatingUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_substituteUserId_fkey" FOREIGN KEY ("substituteUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalDelegation" ADD CONSTRAINT "ApprovalDelegation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_representedUserId_fkey" FOREIGN KEY ("representedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "ApprovalDelegation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
