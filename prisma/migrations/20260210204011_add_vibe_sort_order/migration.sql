-- AlterTable
ALTER TABLE "StudioItem" ADD COLUMN "model" TEXT;

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "localPath" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceForClipId" INTEGER,
    "resultForClipId" INTEGER,
    "studioItemId" INTEGER,
    "episodeId" TEXT,
    CONSTRAINT "Media_referenceForClipId_fkey" FOREIGN KEY ("referenceForClipId") REFERENCES "Clip" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Media_resultForClipId_fkey" FOREIGN KEY ("resultForClipId") REFERENCES "Clip" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Media_studioItemId_fkey" FOREIGN KEY ("studioItemId") REFERENCES "StudioItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Media_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Vibe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ACTION',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "seriesId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vibe_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Vibe" ("createdAt", "id", "prompt", "seriesId", "title", "type", "updatedAt") SELECT "createdAt", "id", "prompt", "seriesId", "title", "type", "updatedAt" FROM "Vibe";
DROP TABLE "Vibe";
ALTER TABLE "new_Vibe" RENAME TO "Vibe";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
