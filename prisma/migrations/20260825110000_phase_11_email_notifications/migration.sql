CREATE TYPE "EmailNotificationType" AS ENUM ('PASSWORD_RESET', 'USER_INVITATION', 'APPROVAL_REQUIRED_AVOR', 'APPROVAL_REQUIRED_TECHNICAL', 'TASK_ASSIGNED', 'REQUEST_CHANGES_REQUIRED', 'REQUEST_APPROVED', 'REQUEST_PHASE_CHANGED', 'REQUEST_CLOSED');
CREATE TYPE "EmailNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DELIVERED', 'BOUNCED', 'COMPLAINED');

CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailNotification" (
  "id" TEXT NOT NULL,
  "type" "EmailNotificationType" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "recipientUserId" TEXT,
  "recipientEmail" TEXT NOT NULL,
  "recipientName" TEXT,
  "changeRequestId" TEXT,
  "taskId" TEXT,
  "subject" TEXT NOT NULL,
  "templateData" JSONB,
  "status" "EmailNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "nextAttemptAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  CONSTRAINT "EmailNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");
CREATE UNIQUE INDEX "EmailNotification_idempotencyKey_key" ON "EmailNotification"("idempotencyKey");
CREATE UNIQUE INDEX "EmailNotification_providerMessageId_key" ON "EmailNotification"("providerMessageId");
CREATE INDEX "EmailNotification_status_nextAttemptAt_idx" ON "EmailNotification"("status", "nextAttemptAt");
CREATE INDEX "EmailNotification_changeRequestId_createdAt_idx" ON "EmailNotification"("changeRequestId", "createdAt");
CREATE INDEX "EmailNotification_taskId_createdAt_idx" ON "EmailNotification"("taskId", "createdAt");
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailNotification" ADD CONSTRAINT "EmailNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailNotification" ADD CONSTRAINT "EmailNotification_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailNotification" ADD CONSTRAINT "EmailNotification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
