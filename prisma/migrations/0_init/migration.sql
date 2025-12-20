-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "totalEpisodes" INTEGER DEFAULT 1,
    "status" TEXT
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "model" TEXT,
    "seriesId" TEXT NOT NULL,
    CONSTRAINT "Episode_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudioItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "refImageUrl" TEXT,
    "negatives" TEXT,
    "notes" TEXT,
    "episode" TEXT,
    "seriesId" TEXT NOT NULL,
    CONSTRAINT "StudioItem_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Clip" (
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
    "taskId" TEXT,
    "episodeId" TEXT NOT NULL,
    CONSTRAINT "Clip_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

