CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'SUPABASE');
ALTER TABLE "Attachment" ADD COLUMN "storageProvider" "StorageProvider" NOT NULL DEFAULT 'LOCAL';
