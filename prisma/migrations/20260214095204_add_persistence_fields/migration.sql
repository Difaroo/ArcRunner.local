-- AlterTable
ALTER TABLE "Episode" ADD COLUMN "localMediaPath" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Clip" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "scene" TEXT,
    "title" TEXT,
    "action" TEXT,
    "dialog" TEXT,
    "character" TEXT,
    "location" TEXT,
    "style" TEXT,
    "camera" TEXT,
    "movement" TEXT,
    "model" TEXT,
    "seed" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "negativePrompt" TEXT,
    "refImageUrls" TEXT,
    "resultUrl" TEXT,
    "thumbnailPath" TEXT,
    "previewUrl" TEXT,
    "isHiddenInStoryboard" BOOLEAN NOT NULL DEFAULT false,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "isPersisted" BOOLEAN NOT NULL DEFAULT false,
    "taskId" TEXT,
    "episodeId" TEXT NOT NULL,
    "lockedBy" TEXT,
    "lockedAt" DATETIME,
    CONSTRAINT "Clip_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Clip" ("action", "camera", "character", "dialog", "episodeId", "id", "isHiddenInStoryboard", "isSelected", "location", "lockedAt", "lockedBy", "model", "movement", "negativePrompt", "previewUrl", "refImageUrls", "resultUrl", "scene", "seed", "sortOrder", "status", "style", "taskId", "thumbnailPath", "title") SELECT "action", "camera", "character", "dialog", "episodeId", "id", "isHiddenInStoryboard", "isSelected", "location", "lockedAt", "lockedBy", "model", "movement", "negativePrompt", "previewUrl", "refImageUrls", "resultUrl", "scene", "seed", "sortOrder", "status", "style", "taskId", "thumbnailPath", "title" FROM "Clip";
DROP TABLE "Clip";
ALTER TABLE "new_Clip" RENAME TO "Clip";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
