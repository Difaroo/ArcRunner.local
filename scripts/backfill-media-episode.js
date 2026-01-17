/**
 * Backfill Script: Set episodeId on existing Media records
 * 
 * This script:
 * 1. For Media with referenceForClipId → get Clip.episodeId → set Media.episodeId
 * 2. For Media with resultForClipId → get Clip.episodeId → set Media.episodeId
 * 3. For Media with studioItemId → lookup episode from StudioItem
 */

const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient({
    datasources: {
        db: { url: 'file:./dev.db' }
    }
});

async function backfillEpisodeId() {
    console.log('🚀 Starting Media episodeId Backfill...\n');

    // 1. Fetch all Media with their clip/studio relations
    const allMedia = await db.media.findMany({
        include: {
            referenceForClip: { select: { episodeId: true } },
            resultForClip: { select: { episodeId: true } },
            studioItem: { select: { episode: true, seriesId: true } }
        }
    });

    console.log(`📋 Found ${allMedia.length} total Media records\n`);

    let updated = 0;
    let skipped = 0;
    let noSource = 0;

    for (const media of allMedia) {
        // Skip if already has episodeId
        if (media.episodeId) {
            skipped++;
            continue;
        }

        let episodeId = null;

        // Priority 1: From reference clip
        if (media.referenceForClip?.episodeId) {
            episodeId = media.referenceForClip.episodeId;
        }
        // Priority 2: From result clip
        else if (media.resultForClip?.episodeId) {
            episodeId = media.resultForClip.episodeId;
        }
        // Priority 3: From studio item (need to lookup episode by number + seriesId)
        else if (media.studioItem?.episode && media.studioItem?.seriesId) {
            const episodeNumber = parseInt(media.studioItem.episode);
            if (!isNaN(episodeNumber)) {
                const ep = await db.episode.findFirst({
                    where: {
                        seriesId: media.studioItem.seriesId,
                        number: episodeNumber
                    }
                });
                if (ep) {
                    episodeId = ep.id;
                }
            }
        }

        if (episodeId) {
            await db.media.update({
                where: { id: media.id },
                data: { episodeId }
            });
            updated++;
            console.log(`✅ Set episodeId for Media ${media.id.substring(0, 8)}... → ${episodeId.substring(0, 8)}...`);
        } else {
            noSource++;
            console.log(`⚠️  No episode source for Media ${media.id.substring(0, 8)}... (URL: ${media.url.substring(0, 40)}...)`);
        }
    }

    console.log('\n----------------------------');
    console.log(`🎉 Backfill Complete!`);
    console.log(`   Updated:   ${updated}`);
    console.log(`   Skipped:   ${skipped} (already had episodeId)`);
    console.log(`   No Source: ${noSource} (orphaned)`);
    console.log('----------------------------\n');

    await db.$disconnect();
}

backfillEpisodeId().catch(e => {
    console.error('Fatal Error:', e);
    process.exit(1);
});
