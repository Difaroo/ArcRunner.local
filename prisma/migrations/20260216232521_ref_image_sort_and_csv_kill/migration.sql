/*
  Warnings:

  - You are about to drop the column `refImageUrls` on the `Clip` table. All the data in the column will be lost.

*/
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
INSERT INTO "new_Clip" ("action", "camera", "character", "dialog", "episodeId", "id", "isHiddenInStoryboard", "isPersisted", "isSelected", "location", "lockedAt", "lockedBy", "model", "movement", "negativePrompt", "previewUrl", "resultUrl", "scene", "seed", "sortOrder", "status", "style", "taskId", "thumbnailPath", "title") SELECT "action", "camera", "character", "dialog", "episodeId", "id", "isHiddenInStoryboard", "isPersisted", "isSelected", "location", "lockedAt", "lockedBy", "model", "movement", "negativePrompt", "previewUrl", "resultUrl", "scene", "seed", "sortOrder", "status", "style", "taskId", "thumbnailPath", "title" FROM "Clip";
DROP TABLE "Clip";
ALTER TABLE "new_Clip" RENAME TO "Clip";
CREATE TABLE "new_Media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "localPath" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "refImageSort" INTEGER NOT NULL DEFAULT 0,
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
INSERT INTO "new_Media" ("category", "createdAt", "episodeId", "height", "id", "localPath", "mimeType", "referenceForClipId", "resultForClipId", "size", "studioItemId", "type", "url", "width") SELECT "category", "createdAt", "episodeId", "height", "id", "localPath", "mimeType", "referenceForClipId", "resultForClipId", "size", "studioItemId", "type", "url", "width" FROM "Media";
DROP TABLE "Media";
ALTER TABLE "new_Media" RENAME TO "Media";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
