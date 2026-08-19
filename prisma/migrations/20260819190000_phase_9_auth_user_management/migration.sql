ALTER TABLE "User"
  ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastLoginAt" TIMESTAMP(3);

UPDATE "User"
SET "firstName" = CASE WHEN position(' ' in "name") > 0 THEN split_part("name", ' ', 1) ELSE "name" END,
    "lastName" = CASE WHEN position(' ' in "name") > 0 THEN substring("name" from position(' ' in "name") + 1) ELSE '' END,
    "email" = lower(trim("email"));

INSERT INTO "UserRole" ("userId", "roleId")
SELECT ur."userId", avor."id"
FROM "UserRole" ur
JOIN "Role" purchasing ON purchasing."id" = ur."roleId" AND purchasing."key" = 'PURCHASING'
CROSS JOIN "Role" avor
WHERE avor."key" = 'AVOR'
ON CONFLICT ("userId", "roleId") DO NOTHING;

DELETE FROM "UserRole"
USING "Role"
WHERE "UserRole"."roleId" = "Role"."id" AND "Role"."key" = 'PURCHASING';

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
