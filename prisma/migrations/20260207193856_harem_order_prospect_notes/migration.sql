/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Harem` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Harem" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "Harem_name_key" ON "Harem"("name");
