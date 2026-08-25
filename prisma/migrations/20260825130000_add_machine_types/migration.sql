INSERT INTO "MachineType" ("id", "code", "name", "active", "createdAt", "updatedAt")
VALUES
  ('machine-wr-2100-s', 'WR-2100 S', 'WR-2100 S', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('machine-wr-600-v', 'WR-600 V', 'WR-600 V', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('machine-vp-2', 'VP-2', 'VP-2', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name", "active" = true, "updatedAt" = CURRENT_TIMESTAMP;
