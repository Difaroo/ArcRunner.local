-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Vibe" (
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
INSERT INTO "new_Vibe" ("createdAt", "id", "prompt", "seriesId", "sortOrder", "title", "type", "updatedAt") SELECT "createdAt", "id", "prompt", "seriesId", "sortOrder", "title", "type", "updatedAt" FROM "Vibe";
DROP TABLE "Vibe";
ALTER TABLE "new_Vibe" RENAME TO "Vibe";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
