INSERT INTO "MachineType" ("id", "code", "name", "active", "createdAt", "updatedAt")
VALUES ('machine-sqb-2at', 'SQB-2AT', 'SQB-2AT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "active" = true, "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "MachineType"
SET "active" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN ('BLS-12', 'SQB-2A', 'SQB-AT', 'SQT-AT');
