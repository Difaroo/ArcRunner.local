/**
 * One-time recovery script: Extracts legacy `refImageUrls` CSV data from an offline 
 * SQLite backup database and injects them as normalized `Media` records into the active Prod database.
 * 
 * Target: prisma/prod_v2.db (Active Database)
 * Source: prisma/prod_v2.db.backup_v0.31.0_20260209_140843 (Backup Database)
 */

import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import path from 'path';

const ACTIVE_DB_PATH = path.resolve(process.cwd(), 'prisma', 'prod_v2.db');
const BACKUP_DB_PATH = path.resolve(process.cwd(), 'prisma', 'prod_v2.db.backup_v0.31.0_20260209_140843');

// Initialize Prisma against the active prod database
const prisma = new PrismaClient({
    datasources: {
        db: { url: `file:${ACTIVE_DB_PATH}` }
    }
});

interface RawClipRow {
    id: number;
    refImageUrls: string | null;
    episodeId: string;
}

interface MediaRefCount {
    count: number;
}

async function main() {
    console.log(`[Recovery] Starting offline CSV extraction from backup...`);
    console.log(`[Recovery] Backup Source: ${BACKUP_DB_PATH}`);
    console.log(`[Recovery] Active Target: ${ACTIVE_DB_PATH}`);

    let backupDb;
    try {
        backupDb = new Database(BACKUP_DB_PATH, { fileMustExist: true, readonly: true });
    } catch (error: any) {
        console.error(`[Recovery] FATAL: Could not open backup database. Does it exist?`);
        console.error(error.message);
        process.exit(1);
    }

    // 1. Extract the raw CSV rows from the backup database
    const clips: RawClipRow[] = backupDb.prepare(`
    SELECT id, refImageUrls, episodeId FROM Clip 
    WHERE refImageUrls IS NOT NULL AND refImageUrls != ''
  `).all() as RawClipRow[];

    backupDb.close();

    if (clips.length === 0) {
        console.log('[Recovery] No CSV records found in the backup. Nothing to recover.');
        return;
    }

    console.log(`[Recovery] Extracted ${clips.length} rows with legacy CSV data from the backup.`);

    let migratedCount = 0;
    let skippedCount = 0;
    let totalInjected = 0;

    // 2. Inject normalized Media records into the active database
    for (const clip of clips) {
        const csv = clip.refImageUrls;
        if (!csv || csv.trim() === '') {
            skippedCount++;
            continue;
        }

        // Parse CSV
        const urls = csv.split(',').map((s: string) => s.trim()).filter(Boolean);
        if (urls.length === 0) {
            skippedCount++;
            continue;
        }

        // 3. Prevent duplicate injections in case script is run multiple times
        const existing = await prisma.$queryRaw<MediaRefCount[]>`
        SELECT COUNT(*) as count FROM Media 
        WHERE referenceForClipId = ${clip.id}
    `;

        if (existing[0] && Number(existing[0].count) > 0) {
            console.log(`[Recovery] Clip ${clip.id} already has ${existing[0].count} media refs in active DB, skipping injection`);
            skippedCount++;
            continue;
        }

        // 4. Create Media records directly
        for (const url of urls) {
            const isVideo = !!url.match(/\.(mp4|mov|webm|mkv)($|\?)/i);
            const mediaType = isVideo ? 'VIDEO' : 'IMAGE';
            const id = crypto.randomUUID();

            await prisma.$executeRaw`
          INSERT INTO Media (id, url, type, category, referenceForClipId, episodeId, createdAt)
          VALUES (${id}, ${url}, ${mediaType}, 'REFERENCE', ${clip.id}, ${clip.episodeId}, datetime('now'))
      `;
            totalInjected++;
        }

        migratedCount++;
        console.log(`[Recovery] Clip ID ${clip.id}: Injected ${urls.length} legacy references into active DB`);
    }

    console.log(`\n================================`);
    console.log(`[Recovery] COMPLETE`);
    console.log(`================================`);
    console.log(`Checked Backup Rows: ${clips.length}`);
    console.log(`Clips Restored:      ${migratedCount}`);
    console.log(`Clips Skipped:       ${skippedCount}`);
    console.log(`Total Media Created: ${totalInjected}`);
    console.log(`================================\n`);
}

main()
    .catch((e) => {
        console.error('[Recovery] FATAL:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
