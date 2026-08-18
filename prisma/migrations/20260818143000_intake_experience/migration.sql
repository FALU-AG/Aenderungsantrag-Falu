ALTER TABLE "ChangeRequest" ADD COLUMN "applicantName" TEXT NOT NULL DEFAULT '';

UPDATE "ChangeRequest" AS request
SET "applicantName" = app_user."name"
FROM "User" AS app_user
WHERE request."applicantId" = app_user."id"
  AND request."applicantName" = '';
