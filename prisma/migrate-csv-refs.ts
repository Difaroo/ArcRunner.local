/**
 * One-time migration: Convert legacy refImageUrls CSV data to Media records.
 * Uses raw SQL since refImageUrls column may already be removed from Prisma schema.
 * 
 * Run BEFORE `npx prisma migrate dev` to preserve CSV data.
 * Run with: npx tsx prisma/migrate-csv-refs.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RawClipRow {
    id: number;
    refImageUrls: string | null;
    episodeId: string;
}

interface MediaRefCount {
    count: number;
}

async function main() {
    console.log('[Migration] Starting CSV → Media migration...');

    // Use raw SQL to read the column (may not exist in Prisma schema anymore)
    let clips: RawClipRow[];
    try {
        clips = await prisma.$queryRaw<RawClipRow[]>`
            SELECT id, refImageUrls, episodeId FROM Clip 
            WHERE refImageUrls IS NOT NULL AND refImageUrls != ''
        `;
    } catch (e: any) {
        if (e.message.includes('no such column') || e.message.includes('refImageUrls')) {
            console.log('[Migration] Column refImageUrls already removed. Nothing to migrate.');
            return;
        }
        throw e;
    }

    let migratedCount = 0;
    let skippedCount = 0;

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

        // Check if clip already has media references
        const existing = await prisma.$queryRaw<MediaRefCount[]>`
            SELECT COUNT(*) as count FROM Media 
            WHERE referenceForClipId = ${clip.id}
        `;
        if (existing[0] && existing[0].count > 0) {
            console.log(`[Migration] Clip ${clip.id} already has ${existing[0].count} media refs, skipping`);
            skippedCount++;
            continue;
        }

        // Create Media records
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            const isVideo = !!url.match(/\.(mp4|mov|webm|mkv)($|\?)/i);
            const mediaType = isVideo ? 'VIDEO' : 'IMAGE';
            const id = crypto.randomUUID();
            await prisma.$executeRaw`
                INSERT INTO Media (id, url, type, category, referenceForClipId, episodeId, createdAt)
                VALUES (${id}, ${url}, ${mediaType}, 'REFERENCE', ${clip.id}, ${clip.episodeId}, datetime('now'))
            `;
        }

        migratedCount++;
        console.log(`[Migration] Clip ${clip.id}: migrated ${urls.length} CSV URLs to Media records`);
    }

    console.log(`[Migration] Complete. Migrated: ${migratedCount} clips, Skipped: ${skippedCount} clips`);
}

main()
    .catch(e => {
        console.error('[Migration] FATAL:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
