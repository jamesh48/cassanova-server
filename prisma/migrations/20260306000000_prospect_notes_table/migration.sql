-- CreateTable
CREATE TABLE "ProspectNote" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "prospectId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectNote_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProspectNote" ADD CONSTRAINT "ProspectNote_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate existing notes: insert a ProspectNote for each Prospect that has a non-empty notes value
INSERT INTO "ProspectNote" ("content", "prospectId", "createdAt", "updatedAt")
SELECT "notes", "id", "createdAt", NOW()
FROM "Prospect"
WHERE "notes" IS NOT NULL AND "notes" != '';

-- DropColumn
ALTER TABLE "Prospect" DROP COLUMN "notes";
