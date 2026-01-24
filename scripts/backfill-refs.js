/**
 * Backfill Script: Migrate Legacy refImageUrls CSV to Media Table
 * 
 * This script:
 * 1. Reads all Clips with non-empty refImageUrls
 * 2. Parses the CSV into individual URLs
 * 3. Creates Media records with referenceForClipId set
 * 4. Skips URLs that already have a Media record
 */

const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient({
    datasources: {
        db: { url: 'file:./dev.db' }
    }
});

async function backfillRefs() {
    console.log('🚀 Starting Legacy Ref → Media Backfill...\n');

    // 1. Fetch all clips with refImageUrls
    const clips = await db.clip.findMany({
        where: {
            refImageUrls: {
                not: null,
                not: ''
            }
        },
        select: {
            id: true,
            refImageUrls: true,
            episodeId: true
        }
    });

    console.log(`📋 Found ${clips.length} clips with legacy refImageUrls\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const clip of clips) {
        const urls = clip.refImageUrls
            .split(',')
            .map(u => u.trim())
            .filter(Boolean);

        for (const url of urls) {
            try {
                // Check if Media already exists for this URL + Clip combo
                const existing = await db.media.findFirst({
                    where: {
                        url: url,
                        referenceForClipId: clip.id
                    }
                });

                if (existing) {
                    skipped++;
                    continue;
                }

                // Also check if this URL exists as a reference for ANY clip (avoid duplicates)
                const anyExisting = await db.media.findFirst({
                    where: { url: url, referenceForClipId: { not: null } }
                });

                if (anyExisting) {
                    // URL already linked to another clip - skip to avoid conflicts
                    console.log(`⚠️  URL already linked to Clip ${anyExisting.referenceForClipId}, skipping for Clip ${clip.id}: ${url}`);
                    skipped++;
                    continue;
                }

                // Create new Media record
                await db.media.create({
                    data: {
                        url: url,
                        type: 'IMAGE',
                        category: 'REFERENCE',
                        referenceForClipId: clip.id
                    }
                });

                created++;
                console.log(`✅ Created Media for Clip ${clip.id}: ${url.substring(0, 60)}...`);

            } catch (e) {
                console.error(`❌ Error for Clip ${clip.id}, URL ${url}: ${e.message}`);
                errors++;
            }
        }
    }

    console.log('\n----------------------------');
    console.log(`🎉 Backfill Complete!`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors:  ${errors}`);
    console.log('----------------------------\n');

    await db.$disconnect();
}

backfillRefs().catch(e => {
    console.error('Fatal Error:', e);
    process.exit(1);
});
