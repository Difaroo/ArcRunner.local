-- AlterTable
ALTER TABLE "Clip" ADD COLUMN "lockedAt" DATETIME;
ALTER TABLE "Clip" ADD COLUMN "lockedBy" TEXT;

-- AlterTable
-- StudioItem 'model' already exists in Prod
-- ALTER TABLE "StudioItem" ADD COLUMN "model" TEXT;

-- CreateTable
-- Media table already exists in Prod
-- CREATE TABLE "Media" ( ... );
CREATE TABLE "Vibe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ACTION',
    "seriesId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vibe_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

