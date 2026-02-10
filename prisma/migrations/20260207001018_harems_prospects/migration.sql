-- CreateTable
CREATE TABLE "Harem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "Harem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "haremId" INTEGER,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Harem" ADD CONSTRAINT "Harem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_haremId_fkey" FOREIGN KEY ("haremId") REFERENCES "Harem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
