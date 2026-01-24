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
    "model" TEXT,
    "seed" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "refImageUrls" TEXT,
    "resultUrl" TEXT,
    "thumbnailPath" TEXT,
    "previewUrl" TEXT,
    "isHiddenInStoryboard" BOOLEAN NOT NULL DEFAULT false,
    "taskId" TEXT,
    "episodeId" TEXT NOT NULL,
    CONSTRAINT "Clip_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Clip" ("action", "camera", "character", "dialog", "episodeId", "id", "location", "model", "refImageUrls", "resultUrl", "scene", "seed", "sortOrder", "status", "style", "taskId", "title") SELECT "action", "camera", "character", "dialog", "episodeId", "id", "location", "model", "refImageUrls", "resultUrl", "scene", "seed", "sortOrder", "status", "style", "taskId", "title" FROM "Clip";
DROP TABLE "Clip";
ALTER TABLE "new_Clip" RENAME TO "Clip";
CREATE TABLE "new_Episode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "model" TEXT,
    "storyboardVersion" INTEGER NOT NULL DEFAULT 1,
    "seriesId" TEXT NOT NULL,
    CONSTRAINT "Episode_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Episode" ("id", "model", "number", "seriesId", "title") SELECT "id", "model", "number", "seriesId", "title" FROM "Episode";
DROP TABLE "Episode";
ALTER TABLE "new_Episode" RENAME TO "Episode";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
