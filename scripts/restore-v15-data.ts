
import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient();
const RECOVERY_DB_PATH = path.join(process.cwd(), 'v0.15_RECOVERY_DATA.db');

async function main() {
    console.log(`[Reverse Merge] Reading from ${RECOVERY_DB_PATH}...`);

    // Connect to source DB
    let sourceDb;
    try {
        sourceDb = new Database(RECOVERY_DB_PATH, { readonly: true });
    } catch (err) {
        console.error("Failed to open recovery DB:", err);
        process.exit(1);
    }

    // 1. Recover Series
    console.log('\n--- Recovering Series ---');
    const seriesRows = sourceDb.prepare('SELECT * FROM Series').all() as any[];
    console.log(`Found ${seriesRows.length} Series.`);

    for (const row of seriesRows) {
        // Check if exists
        const exists = await prisma.series.findUnique({ where: { id: row.id } });
        if (exists) {
            console.log(`Skipping existing Series: ${row.name} (${row.id})`);
            continue;
        }

        await prisma.series.create({
            data: {
                id: row.id,
                name: row.name,
                totalEpisodes: row.totalEpisodes,
                status: row.status,
                defaultModel: row.defaultModel
            }
        });
        console.log(`+ Restored Series: ${row.name}`);
    }

    // 2. Recover Episodes
    console.log('\n--- Recovering Episodes ---');
    const episodeRows = sourceDb.prepare('SELECT * FROM Episode').all() as any[];
    console.log(`Found ${episodeRows.length} Episodes.`);

    for (const row of episodeRows) {
        // Ensure parent exists (it should, if we just restored it)
        const parentExists = await prisma.series.findUnique({ where: { id: row.seriesId } });
        if (!parentExists) {
            console.warn(`! Orphan Episode ${row.number} (Series ${row.seriesId} missing). Skipping.`);
            continue;
        }

        const exists = await prisma.episode.findUnique({ where: { id: row.id } });
        if (exists) {
            console.log(`Skipping existing Episode ${row.number} (${row.id})`);
            continue;
        }

        await prisma.episode.create({
            data: {
                id: row.id,
                number: row.number,
                title: row.title,
                model: row.model,
                storyboardVersion: row.storyboardVersion,
                aspectRatio: row.aspectRatio,
                style: row.style,
                guidance: row.guidance,
                seed: row.seed,
                seriesId: row.seriesId
            }
        });
        console.log(`+ Restored Episode ${row.number}`);
    }

    // 3. Recover Studio Items (Library)
    console.log('\n--- Recovering Studio Items ---');
    const studioRows = sourceDb.prepare('SELECT * FROM StudioItem').all() as any[];
    console.log(`Found ${studioRows.length} Studio Items.`);

    for (const row of studioRows) {
        const parentExists = await prisma.series.findUnique({ where: { id: row.seriesId } });
        if (!parentExists) {
            console.warn(`! Orphan StudioItem (Series ${row.seriesId} missing). Skipping.`);
            continue;
        }

        // ID is autoincrement in target, so we cannot force it unless we reset seq. 
        // BUT, if we want to preserve relationships, we might need to be careful?
        // Actually, StudioItems are usually not linked TO by ID in this schema (Clips store strings/names usually).
        // Wait, check Clip schema: "character" is string names. "location" is string.
        // So we don't strictly NEED to preserve the integer ID. Using create() without ID will generate new ID.
        // However, checking for duplicates by NAME + SERIES is safer to avoid dupes.

        // Note: row.id is in source. Target is autoincrement.
        // If we include `id` in `data`, Prisma inserts it if the DB allows (SQLite does).
        // Let's try to preserve ID to be safe, handling conflict if ID taken.

        const exists = await prisma.studioItem.findUnique({ where: { id: row.id } });
        if (exists) {
            // If ID matches, logic: is it the same?
            // Let's just skip if ID clash, and warn.
            console.log(`Skipping existing StudioItem ID ${row.id} (${row.name})`);
            continue;
        }

        await prisma.studioItem.create({
            data: {
                id: row.id, // Force ID restoration
                type: row.type,
                name: row.name,
                description: row.description,
                refImageUrl: row.refImageUrl,
                thumbnailPath: row.thumbnailPath,
                negatives: row.negatives,
                notes: row.notes,
                episode: row.episode,
                status: row.status,
                taskId: row.taskId,
                seriesId: row.seriesId
            }
        });
        console.log(`+ Restored Studio Item: ${row.name}`);
    }

    // 4. Recover Clips
    console.log('\n--- Recovering Clips ---');
    const clipRows = sourceDb.prepare('SELECT * FROM Clip').all() as any[];
    console.log(`Found ${clipRows.length} Clips.`);

    for (const row of clipRows) {
        const parentExists = await prisma.episode.findUnique({ where: { id: row.episodeId } });
        if (!parentExists) {
            console.warn(`! Orphan Clip ${row.scene} (Episode ${row.episodeId} missing). Skipping.`);
            continue;
        }

        const exists = await prisma.clip.findUnique({ where: { id: row.id } });
        if (exists) {
            console.log(`Skipping existing Clip ID ${row.id} (${row.scene})`);
            continue;
        }

        await prisma.clip.create({
            data: {
                id: row.id, // Force ID
                status: row.status,
                scene: row.scene,
                title: row.title,
                action: row.action,
                dialog: row.dialog,
                character: row.character,
                location: row.location,
                style: row.style,
                camera: row.camera,
                model: row.model,
                seed: row.seed,
                sortOrder: row.sortOrder,
                refImageUrls: row.refImageUrls,
                resultUrl: row.resultUrl,
                thumbnailPath: row.thumbnailPath,
                previewUrl: row.previewUrl,
                isHiddenInStoryboard: Boolean(row.isHiddenInStoryboard),
                taskId: row.taskId,
                episodeId: row.episodeId
            }
        });
        console.log(`+ Restored Clip: ${row.scene}`);
    }

    console.log('\n--- Restore Complete ---');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        if ((global as any).sourceDb) (global as any).sourceDb.close();
    });
