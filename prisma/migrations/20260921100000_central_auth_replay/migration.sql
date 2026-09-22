BEGIN;
CREATE TABLE "AppAssertionUse" ("id" TEXT PRIMARY KEY, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "AppAssertionUse_expiresAt_idx" ON "AppAssertionUse"("expiresAt");
ALTER TABLE "AppAssertionUse" ENABLE ROW LEVEL SECURITY;
COMMIT;
