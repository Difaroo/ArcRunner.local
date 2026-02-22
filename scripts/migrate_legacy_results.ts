import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateLegacyResults() {
    console.log("=== ARCRUNNER DATABASE: MIGRATE LEGACY RESULTS ===\n");

    const clips = await prisma.clip.findMany({
        where: {
            resultUrl: { not: null },
            mediaResults: { none: {} }
        },
        include: { mediaResults: true }
    });

    console.log(`Found ${clips.length} clips needing migration from resultUrl to Media records.`);

    let migratedCount = 0;
    let createdMediaCount = 0;

    for (const clip of clips) {
        if (!clip.resultUrl) continue;

        // Legacy resultUrls could be comma-separated if multiple generations were stitched/appended
        const urls = clip.resultUrl.split(',').map(u => u.trim()).filter(u => u.length > 0);

        if (urls.length > 0) {
            console.log(`Migrating Clip ${clip.id} -> ${urls.length} media records...`);

            for (const url of urls) {
                // Determine type based on extension
                const type = url.toLowerCase().endsWith('.mp4') ? 'VIDEO' : 'IMAGE';

                await prisma.media.create({
                    data: {
                        url,
                        type,
                        category: 'RESULT',
                        resultForClipId: clip.id
                    }
                });
                createdMediaCount++;
            }
            migratedCount++;
        }
    }

    console.log(`\n✅ Migration complete.`);
    console.log(`   - Clips Migrated: ${migratedCount}`);
    console.log(`   - Media Records Created: ${createdMediaCount}`);

    await prisma.$disconnect();
}

migrateLegacyResults().catch(console.error);
