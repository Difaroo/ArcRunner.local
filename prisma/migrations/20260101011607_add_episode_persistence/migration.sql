-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Episode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "model" TEXT,
    "storyboardVersion" INTEGER NOT NULL DEFAULT 1,
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "style" TEXT,
    "guidance" REAL DEFAULT 5.0,
    "seed" INTEGER,
    "seriesId" TEXT NOT NULL,
    CONSTRAINT "Episode_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Episode" ("id", "model", "number", "seriesId", "storyboardVersion", "title") SELECT "id", "model", "number", "seriesId", "storyboardVersion", "title" FROM "Episode";
DROP TABLE "Episode";
ALTER TABLE "new_Episode" RENAME TO "Episode";
CREATE TABLE "new_StudioItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "refImageUrl" TEXT,
    "thumbnailPath" TEXT,
    "negatives" TEXT,
    "notes" TEXT,
    "episode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "taskId" TEXT,
    "seriesId" TEXT NOT NULL,
    CONSTRAINT "StudioItem_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StudioItem" ("description", "episode", "id", "name", "negatives", "notes", "refImageUrl", "seriesId", "type") SELECT "description", "episode", "id", "name", "negatives", "notes", "refImageUrl", "seriesId", "type" FROM "StudioItem";
DROP TABLE "StudioItem";
ALTER TABLE "new_StudioItem" RENAME TO "StudioItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
