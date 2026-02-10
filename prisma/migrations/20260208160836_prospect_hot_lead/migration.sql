-- DropIndex
DROP INDEX "Harem_name_key";

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "hotLead" BOOLEAN NOT NULL DEFAULT false;
