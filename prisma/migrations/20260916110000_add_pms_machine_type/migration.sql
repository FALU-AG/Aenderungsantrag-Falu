INSERT INTO "MachineType" ("id", "code", "name", "active", "createdAt", "updatedAt")
VALUES ('machine-pms', 'PMS', 'PMS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name", "active" = true, "updatedAt" = CURRENT_TIMESTAMP;
