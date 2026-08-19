ALTER TABLE "PurchasingReview"
ADD COLUMN "supplierNotes" TEXT,
ADD COLUMN "orderNumber" TEXT,
ADD COLUMN "orderDate" TIMESTAMP(3),
ADD COLUMN "orderedById" TEXT;

ALTER TABLE "PurchasingReview"
ADD CONSTRAINT "PurchasingReview_orderedById_fkey"
FOREIGN KEY ("orderedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
