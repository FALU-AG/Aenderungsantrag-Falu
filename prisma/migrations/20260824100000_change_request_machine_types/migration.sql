-- Add the multi-machine relation without removing the legacy column. Keeping the
-- old column makes this a non-destructive, staged migration.
CREATE TABLE "ChangeRequestMachineType" (
    "changeRequestId" TEXT NOT NULL,
    "machineTypeId" TEXT NOT NULL,

    CONSTRAINT "ChangeRequestMachineType_pkey" PRIMARY KEY ("changeRequestId", "machineTypeId")
);

CREATE INDEX "ChangeRequestMachineType_machineTypeId_idx"
ON "ChangeRequestMachineType"("machineTypeId");

ALTER TABLE "ChangeRequestMachineType"
ADD CONSTRAINT "ChangeRequestMachineType_changeRequestId_fkey"
FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChangeRequestMachineType"
ADD CONSTRAINT "ChangeRequestMachineType_machineTypeId_fkey"
FOREIGN KEY ("machineTypeId") REFERENCES "MachineType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ChangeRequestMachineType" ("changeRequestId", "machineTypeId")
SELECT "id", "machineTypeId"
FROM "ChangeRequest"
WHERE "machineTypeId" IS NOT NULL
ON CONFLICT ("changeRequestId", "machineTypeId") DO NOTHING;

-- Abort the migration if any historical single-machine assignment was not copied.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ChangeRequest" cr
    WHERE cr."machineTypeId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "ChangeRequestMachineType" crmt
        WHERE crmt."changeRequestId" = cr."id"
          AND crmt."machineTypeId" = cr."machineTypeId"
      )
  ) THEN
    RAISE EXCEPTION 'Machine type migration verification failed';
  END IF;
END $$;
