CREATE TABLE IF NOT EXISTS "Series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "totalEpisodes" INTEGER DEFAULT 1,
    "status" TEXT
, "defaultModel" TEXT);
CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS "Episode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "model" TEXT,
    "storyboardVersion" INTEGER NOT NULL DEFAULT 1,
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "style" TEXT,
    "guidance" REAL DEFAULT 5.0,
    "seed" INTEGER,
    "seriesId" TEXT NOT NULL, "localMediaPath" TEXT,
    CONSTRAINT "Episode_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "StudioItem" (
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
    "seriesId" TEXT NOT NULL, "model" TEXT,
    CONSTRAINT "StudioItem_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Vibe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ACTION',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "seriesId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vibe_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Clip" (
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
CREATE TABLE IF NOT EXISTS "Media" (
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
    "episodeId" TEXT, "thumbnailPath" TEXT,
    CONSTRAINT "Media_referenceForClipId_fkey" FOREIGN KEY ("referenceForClipId") REFERENCES "Clip" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Media_resultForClipId_fkey" FOREIGN KEY ("resultForClipId") REFERENCES "Clip" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Media_studioItemId_fkey" FOREIGN KEY ("studioItemId") REFERENCES "StudioItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Media_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
